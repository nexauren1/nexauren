import {
  getToolPlan,
  planRank,
  checkToolFeature,
  upgradeRequired
} from "./access-control.js";

const COOKIE = "nexauren_session";
const MODEL = "@cf/black-forest-labs/flux-2-klein-9b";

const FEATURE_FALLBACKS = {
  "image-editing": "pro",
  variations: "pro",
  "multi-reference": "premium",
  "creative-control": "premium"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });

async function user(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return null;
  return env.DB.prepare(
    "SELECT u.id,u.email,u.name " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();
}

async function featureRows(env, plan) {
  const rows = await env.TOOLS_DB.prepare(
    "SELECT feature_key,required_plan,name,description " +
    "FROM tool_features " +
    "WHERE tool_slug=? AND active=1 ORDER BY feature_key"
  ).bind("ai-image-generator").all();

  return (rows.results || []).map((row) => ({
    key: row.feature_key,
    name: row.name,
    description: row.description,
    required_plan: row.required_plan,
    unlocked: planRank(plan) >= planRank(row.required_plan)
  }));
}

function dataImageToBlob(value) {
  const match = String(value || "").match(
    /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/
  );
  if (!match) throw new Error("Invalid image format.");
  const binary = Uint8Array.from(
    atob(match[2]),
    (char) => char.charCodeAt(0)
  );
  if (binary.byteLength > 5 * 1024 * 1024) {
    throw new Error("Uploaded image is too large.");
  }
  return new Blob([binary], {
    type: match[1] === "jpg"
      ? "image/jpeg"
      : `image/${match[1]}`
  });
}

async function runModel(env, prompt, width, height, images, guidance) {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(width));
  form.append("height", String(height));
  form.append(
    "seed",
    String(Math.floor(Math.random() * 2147483647))
  );

  images.forEach((image, index) => {
    form.append("input_image_" + index, image, `reference-${index}.jpg`);
  });

  if (guidance) form.append("guidance", String(guidance));

  const formResponse = new Response(form);
  const response = await env.AI.run(MODEL, {
    multipart: {
      body: formResponse.body,
      contentType: formResponse.headers.get("content-type")
    }
  });

  if (!response?.image) {
    throw new Error("The image model returned no image.");
  }

  return response.image;
}

async function requireConfiguredFeature(env, userId, featureKey) {
  const result = await checkToolFeature(
    env,
    userId,
    "ai-image-generator",
    featureKey
  );

  if (result.code === "FEATURE_NOT_CONFIGURED") {
    const fallback = FEATURE_FALLBACKS[featureKey];
    if (!fallback) return result;
    return {
      ok: false,
      code: "UPGRADE_REQUIRED",
      plan: await getToolPlan(env, userId),
      required_plan: fallback,
      feature: { name: featureKey }
    };
  }

  return result;
}

export async function handleAIImage(req, env) {
  const path = new URL(req.url).pathname;
  if (!path.startsWith("/api/ai/image")) return null;

  const currentUser = await user(req, env);
  const plan = currentUser
    ? await getToolPlan(env, currentUser.id)
    : "free";

  if (path === "/api/ai/image/access" && req.method === "GET") {
    if (!currentUser) {
      return json({
        ok: false,
        code: "LOGIN_REQUIRED",
        error: "Please log in to view image feature access."
      }, 401);
    }

    return json({
      ok: true,
      plan,
      features: await featureRows(env, plan)
    });
  }

  if (path !== "/api/ai/image" || req.method !== "POST") {
    return json({ ok: false, error: "Not found." }, 404);
  }

  if (!currentUser) {
    return json({
      ok: false,
      code: "LOGIN_REQUIRED",
      error: "Please log in to use AI Image Generator."
    }, 401);
  }

  if (!env.AI) {
    return json({ ok: false, error: "Workers AI is not configured." }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const prompt = String(body?.prompt || "").trim();
  const style = String(body?.style || "photorealistic");
  const size = String(body?.size || "square");
  const mode = String(body?.mode || "generate");
  const feature = String(body?.feature || "");
  const inputImage = String(body?.input_image || "");
  const referenceImages = Array.isArray(body?.reference_images)
    ? body.reference_images.map(String).filter(Boolean)
    : [];
  const variationCount = Math.min(
    4,
    Math.max(1, Number(body?.variation_count || 1))
  );

  if (!prompt) {
    return json({
      ok: false,
      error: "Describe the image you want to create or edit."
    }, 400);
  }
  if (prompt.length > 2000) {
    return json({ ok: false, error: "Prompt is too long." }, 400);
  }

  if (mode === "edit" && !inputImage) {
    return json({ ok: false, error: "Upload an image first." }, 400);
  }

  if (feature && !FEATURE_FALLBACKS[feature]) {
    return json({ ok: false, error: "Invalid image feature." }, 400);
  }

  const requiredFeature = mode === "edit"
    ? "image-editing"
    : feature;

  if (requiredFeature) {
    const access = await requireConfiguredFeature(
      env,
      currentUser.id,
      requiredFeature
    );
    if (!access.ok) {
      return json(upgradeRequired(access), 403);
    }
  }

  if (feature === "variations" && variationCount < 2) {
    return json({
      ok: false,
      error: "Choose at least 2 variations."
    }, 400);
  }

  if (feature === "multi-reference") {
    if (referenceImages.length < 2 || referenceImages.length > 4) {
      return json({
        ok: false,
        error: "Multi-Reference requires 2 to 4 images."
      }, 400);
    }
  }

  if (referenceImages.length > 4) {
    return json({
      ok: false,
      error: "A maximum of 4 reference images is supported."
    }, 400);
  }

  const styles = {
    photorealistic: "photorealistic",
    cinematic: "cinematic photography",
    "digital-art": "high quality digital art",
    illustration: "clean detailed illustration",
    minimal: "clean minimalist artwork"
  };

  const sizes = {
    square: [1024, 1024],
    portrait: [768, 1024],
    landscape: [1024, 768]
  };

  if (!styles[style] || !sizes[size]) {
    return json({ ok: false, error: "Invalid image options." }, 400);
  }

  const [width, height] = sizes[size];
  const enhancedPrompt = [
    prompt,
    styles[style],
    `${size} composition`,
    "high quality, strong composition, coherent details"
  ].join(", ");

  let editImage = null;
  let references = [];

  try {
    if (inputImage) editImage = dataImageToBlob(inputImage);
    references = referenceImages.map(dataImageToBlob);
  } catch (error) {
    return json({
      ok: false,
      error: String(error?.message || "Could not read uploaded images.")
    }, 400);
  }

  const images = editImage
    ? [editImage]
    : references;

  try {
    const total = feature === "variations" ? variationCount : 1;
    const imagesOut = [];
    const guidance = feature === "creative-control" ? 5.5 : null;

    for (let index = 0; index < total; index += 1) {
      const requestPrompt = editImage
        ? `Edit the reference image according to this instruction: ${enhancedPrompt}`
        : feature === "multi-reference"
          ? `Use all reference images together as visual guidance. ${enhancedPrompt}`
          : enhancedPrompt;

      const image = await runModel(
        env,
        requestPrompt,
        width,
        height,
        images,
        guidance
      );
      imagesOut.push(image);
    }

    return json({
      ok: true,
      image: imagesOut[0],
      images: imagesOut,
      model: "flux-2-klein-9b",
      mode,
      feature: feature || null,
      plan
    });
  } catch (error) {
    return json({
      ok: false,
      error: "Image generation failed.",
      detail: String(error?.message || error).slice(0, 300)
    }, 502);
  }
}

const COOKIE = "nexauren_session";
const MODEL = "@cf/black-forest-labs/flux-2-klein-9b";

const FEATURES = {
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

function rank(plan) {
  return { free: 0, pro: 1, premium: 2 }[plan] ?? 0;
}

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

async function planData(userId, env) {
  return env.DB.prepare(
    "SELECT p.slug FROM subscriptions s " +
    "JOIN plans p ON p.id=s.plan_id " +
    "WHERE s.user_id=? AND s.status='active' " +
    "ORDER BY s.created_at DESC LIMIT 1"
  ).bind(userId).first();
}

function featureRows(plan) {
  return Object.entries(FEATURES).map(([key, required]) => ({
    key,
    required_plan: required,
    unlocked: rank(plan) >= rank(required)
  }));
}

export async function handleAIImage(req, env) {
  const path = new URL(req.url).pathname;
  if (!path.startsWith("/api/ai/image")) return null;

  const currentUser = await user(req, env);
  const row = currentUser
    ? await planData(currentUser.id, env)
    : null;
  const plan = String(row?.slug || "free");

  if (path === "/api/ai/image/access" && req.method === "GET") {
    return json({ ok: true, plan, features: featureRows(plan) });
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

  if (!prompt) {
    return json({ ok: false, error: "Describe the image you want to create or edit." }, 400);
  }
  if (prompt.length > 2000) {
    return json({ ok: false, error: "Prompt is too long." }, 400);
  }

  if (mode === "edit" && !inputImage) {
    return json({ ok: false, error: "Upload an image first." }, 400);
  }

  if (feature && !FEATURES[feature]) {
    return json({ ok: false, error: "Invalid image feature." }, 400);
  }

  if (mode === "edit" && rank(plan) < rank("pro")) {
    return json({
      ok: false,
      code: "UPGRADE_REQUIRED",
      required_plan: "pro",
      error: "AI Image Editing requires Pro."
    }, 403);
  }

  if (feature && rank(plan) < rank(FEATURES[feature])) {
    return json({
      ok: false,
      code: "UPGRADE_REQUIRED",
      required_plan: FEATURES[feature],
      error: `This feature requires ${FEATURES[feature]}.`
    }, 403);
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

  let imageBytes = null;
  if (inputImage) {
    try {
      const match = inputImage.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (!match) throw new Error("Invalid image format.");
      const binary = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
      if (binary.byteLength > 5 * 1024 * 1024) {
        return json({ ok: false, error: "Uploaded image is too large." }, 400);
      }
      imageBytes = new Blob([binary], {
        type: match[1] === "jpg" ? "image/jpeg" : `image/${match[1]}`
      });
    } catch (_) {
      return json({ ok: false, error: "Could not read the uploaded image." }, 400);
    }
  }

  try {
    const form = new FormData();
    form.append("prompt", imageBytes
      ? `Edit the reference image according to this instruction: ${enhancedPrompt}`
      : enhancedPrompt);
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("seed", String(Math.floor(Math.random() * 2147483647)));

    if (imageBytes) form.append("input_image_0", imageBytes, "reference.jpg");

    if (feature === "creative-control") {
      form.append("guidance", "5.5");
    }

    const formResponse = new Response(form);
    const response = await env.AI.run(MODEL, {
      multipart: {
        body: formResponse.body,
        contentType: formResponse.headers.get("content-type")
      }
    });

    if (!response?.image) {
      return json({ ok: false, error: "The image model returned no image." }, 502);
    }

    return json({
      ok: true,
      image: response.image,
      model: "flux-2-klein-9b",
      mode,
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

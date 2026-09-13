import samplePackApp from "./sample-pack-worker.js";
import { handleAIImage } from "./ai-image-worker.js";
import { handlePdfSummarizer } from "./pdf-summarizer-worker.js";
import {
  activityApi,
  activityUser,
  logActivity
} from "./activity.js";

async function responseUser(req, env, response) {
  const existing = await activityUser(req, env);
  if (existing) return existing;

  const setCookie = response.headers.get("Set-Cookie") || "";
  const match = setCookie.match(/nexauren_session=([^;]+)/);
  if (!match) return null;

  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();
}

async function logRequestActivity(req, env, response) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const user = await responseUser(req, env, response);
  if (!user) return;

  const success = response.status >= 200 && response.status < 400;
  if (!success) return;

  if (path === "/api/auth/register" || path === "/api/register") {
    await logActivity(
      env,
      user.id,
      "account",
      "account_created",
      "Account created",
      { email: user.email }
    );
    await logActivity(
      env,
      user.id,
      "security",
      "login",
      "Signed in after account creation"
    );
    return;
  }

  if (path === "/api/auth/login" || path === "/api/login") {
    await logActivity(
      env,
      user.id,
      "security",
      "login",
      "Signed in to Nexauren"
    );
    return;
  }

  if (path === "/api/auth/logout" || path === "/api/logout") {
    await logActivity(
      env,
      user.id,
      "security",
      "logout",
      "Signed out of Nexauren"
    );
    return;
  }

  if (path === "/api/paypal/order" && method === "POST") {
    await logActivity(
      env,
      user.id,
      "purchase",
      "purchase_started",
      "Started a credit purchase",
      { provider: "paypal" }
    );
    return;
  }

  if (path === "/api/paypal/capture" && method === "GET") {
    const location = response.headers.get("Location") || "";
    if (location.includes("payment=success")) {
      await logActivity(
        env,
        user.id,
        "purchase",
        "purchase_completed",
        "Credit purchase completed",
        { provider: "paypal" }
      );
      await logActivity(
        env,
        user.id,
        "credit",
        "credits_added",
        "Purchased credits added to account",
        { provider: "paypal" }
      );
    }
    return;
  }

  if (path === "/api/paypal/subscription" && method === "POST") {
    await logActivity(
      env,
      user.id,
      "plan",
      "subscription_started",
      "Started a plan subscription",
      { provider: "paypal" }
    );
    return;
  }

  const tool = getToolFromPath(path, method);
  if (!tool) return;

  let data = {};
  try {
    data = await response.clone().json();
  } catch (_) {}

  const credits = Number(data?.consumed_credits || 0);
  const metadata = {
    tool_slug: tool.slug,
    endpoint: path
  };

  if (data?.ok !== false) {
    await logActivity(
      env,
      user.id,
      "tool",
      "tool_used",
      `Used ${tool.name}`,
      metadata
    );

    if (credits > 0) {
      await logActivity(
        env,
        user.id,
        "credit",
        "credits_used",
        `Used ${credits} credit${credits === 1 ? "" : "s"} on ${tool.name}`,
        { ...metadata, credits }
      );
    }
  }
}

function getToolFromPath(path, method) {
  if (method !== "POST") return null;

  if (path === "/api/tools/sample-pack/consume") {
    return {
      slug: "sample-pack-generator",
      name: "Sample Pack Generator"
    };
  }

  if (path === "/api/tools/ai-writer") {
    return {
      slug: "ai-writer",
      name: "AI Writer"
    };
  }

  if (path === "/api/ai/image") {
    return {
      slug: "ai-image-generator",
      name: "AI Image Generator"
    };
  }

  if (path.startsWith("/api/pdf-summarizer")) {
    return {
      slug: "pdf-summarizer",
      name: "PDF AI"
    };
  }

  return null;
}

export default {
  async fetch(req, env, ctx) {
    if (
      new URL(req.url).pathname === "/api/activity" &&
      req.method === "GET"
    ) {
      return activityApi(req, env);
    }

    const pdfResponse = await handlePdfSummarizer(req, env);
    if (pdfResponse) {
      ctx.waitUntil(logRequestActivity(req, env, pdfResponse));
      return pdfResponse;
    }

    const imageResponse = await handleAIImage(req, env);
    if (imageResponse) {
      ctx.waitUntil(logRequestActivity(req, env, imageResponse));
      return imageResponse;
    }

    const response = await samplePackApp.fetch(req, env, ctx);
    ctx.waitUntil(logRequestActivity(req, env, response));
    return response;
  }
};

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
    await logActivity(env,user.id,"account","account_created","Account created",{email:user.email});
    await logActivity(env,user.id,"security","login","Signed in after account creation");
    return;
  }

  if (path === "/api/auth/login" || path === "/api/login") {
    await logActivity(env,user.id,"security","login","Signed in to Nexauren");
    return;
  }

  if (path === "/api/auth/logout" || path === "/api/logout") {
    await logActivity(env,user.id,"security","logout","Signed out of Nexauren");
    return;
  }

  if (path === "/api/paypal/order" && method === "POST") {
    await logActivity(env,user.id,"purchase","purchase_started","Started a credit purchase",{provider:"paypal"});
    return;
  }

  if (path === "/api/paypal/capture" && method === "GET") {
    const location = response.headers.get("Location") || "";
    if (location.includes("payment=success")) {
      await logActivity(env,user.id,"purchase","purchase_completed","Credit purchase completed",{provider:"paypal"});
      await logActivity(env,user.id,"credit","credits_added","Purchased credits added to account",{provider:"paypal"});
    }
    return;
  }

  if (path === "/api/paypal/subscription" && method === "POST") {
    await logActivity(env,user.id,"plan","subscription_started","Started a plan subscription",{provider:"paypal"});
    return;
  }

  const tool = getToolFromPath(path, method);
  if (!tool) return;

  let data = {};
  try {
    data = await response.clone().json();
  } catch (_) {}

  const credits = Number(data?.consumed_credits || 0);
  const metadata = {tool_slug:tool.slug,endpoint:path};

  if (data?.ok !== false) {
    await logActivity(env,user.id,"tool","tool_used",`Used ${tool.name}`,metadata);
    if (credits > 0) {
      await logActivity(env,user.id,"credit","credits_used",`Used ${credits} credit${credits === 1 ? "" : "s"} on ${tool.name}`,{...metadata,credits});
    }
  }
}

function getToolFromPath(path, method) {
  if (method !== "POST") return null;
  if (path === "/api/tools/sample-pack/consume") return {slug:"sample-pack-generator",name:"Sample Pack Generator"};
  if (path === "/api/tools/ai-writer") return {slug:"ai-writer",name:"AI Writer"};
  if (path === "/api/ai/image") return {slug:"ai-image-generator",name:"AI Image Generator"};
  if (path.startsWith("/api/pdf-summarizer")) return {slug:"pdf-summarizer",name:"PDF AI"};
  return null;
}

async function paypalToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal live credentials are not configured");
  }

  const base = env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PayPal OAuth failed: ${detail.slice(0,400)}`);
  }

  const data = await response.json();
  if (!data.access_token) throw new Error("PayPal did not return an access token");
  return data.access_token;
}

async function paypalOrderApi(req, env, ctx) {
  if (req.method !== "POST") return null;

  const user = await activityUser(req, env);
  if (!user) {
    return new Response(JSON.stringify({error:"Login required"}),{status:401,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  }

  try {
    const body = await req.json();
    const credits = Number(body?.credits);
    const prices = {100:1,300:3,500:5,1000:10};
    const amount = prices[credits];
    if (!amount) {
      return new Response(JSON.stringify({error:"Invalid credit package"}),{status:400,headers:{"Content-Type":"application/json; charset=utf-8"}});
    }

    const pkg = await env.DB.prepare(
      "SELECT id FROM credit_packages WHERE credits=? AND price=? AND active=1 LIMIT 1"
    ).bind(credits,amount).first();

    if (!pkg) {
      return new Response(JSON.stringify({error:"Credit package not found"}),{status:404,headers:{"Content-Type":"application/json; charset=utf-8"}});
    }

    const access = await paypalToken(env);
    const base = env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
    const origin = new URL(req.url).origin;
    const response = await fetch(`${base}/v2/checkout/orders`,{
      method:"POST",
      headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        intent:"CAPTURE",
        purchase_units:[{
          reference_id:pkg.id,
          custom_id:`${user.id}|${pkg.id}`,
          amount:{currency_code:"USD",value:amount.toFixed(2)},
          description:`${credits} Nexauren Credits`
        }],
        application_context:{
          brand_name:"Nexauren",
          user_action:"PAY_NOW",
          return_url:`${origin}/api/paypal/capture`,
          cancel_url:`${origin}/plans/`
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return new Response(JSON.stringify({error:"Unable to create PayPal order",detail:JSON.stringify(data).slice(0,500)}),{status:502,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
    }

    const approve = data.links?.find(link => link.rel === "approve")?.href;
    if (!approve || !data.id) {
      return new Response(JSON.stringify({error:"PayPal approval link was not returned"}),{status:502,headers:{"Content-Type":"application/json; charset=utf-8"}});
    }

    await env.DB.prepare(
      "INSERT INTO credit_purchases(id,user_id,package_id,credits,amount,status,paypal_order_id,created_at) VALUES(?,?,?,?,?,?,?,?)"
    ).bind(tokenForPurchase(),user.id,pkg.id,credits,amount,"pending",data.id,Date.now()).run();

    ctx.waitUntil(logActivity(env,user.id,"purchase","purchase_started","Started a credit purchase",{provider:"paypal",credits,amount,paypal_order_id:data.id}));
    return new Response(JSON.stringify({url:approve,order_id:data.id}),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  } catch (error) {
    return new Response(JSON.stringify({error:"Unable to start PayPal purchase",detail:String(error?.message || error).slice(0,500)}),{status:502,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  }
}

function tokenForPurchase() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(x => x.toString(16).padStart(2,"0")).join("");
}

async function paypalCaptureApi(req, env, ctx) {
  if (req.method !== "GET") return null;

  const user = await activityUser(req, env);
  if (!user) return Response.redirect(new URL("/login/",req.url),302);

  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  if (!orderId) return Response.redirect(new URL("/plans/",req.url),302);

  try {
    const purchase = await env.DB.prepare(
      "SELECT * FROM credit_purchases WHERE paypal_order_id=? AND user_id=? LIMIT 1"
    ).bind(orderId,user.id).first();

    if (!purchase) return Response.redirect(new URL("/plans/?payment=not_found",req.url),302);
    if (purchase.status === "completed") return Response.redirect(new URL("/dashboard/?payment=success",req.url),302);

    const access = await paypalToken(env);
    const base = env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
    const response = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{
      method:"POST",
      headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"}
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return Response.redirect(new URL("/plans/?payment=not_confirmed",req.url),302);

    const status = data.status || data.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (status !== "COMPLETED") return Response.redirect(new URL("/plans/?payment=not_confirmed",req.url),302);

    const now = Date.now();
    const update = await env.DB.prepare(
      "UPDATE credit_purchases SET status='completed',completed_at=? WHERE id=? AND status='pending'"
    ).bind(now,purchase.id).run();

    if (Number(update.meta?.changes || 0) > 0) {
      await env.DB.prepare(
        "UPDATE credit_balances SET purchased_credits=purchased_credits+?,updated_at=? WHERE user_id=?"
      ).bind(purchase.credits,now,user.id).run();

      const balance = await env.DB.prepare(
        "SELECT purchased_credits,purchased_credits_used,plan_credits,plan_credits_used FROM credit_balances WHERE user_id=? LIMIT 1"
      ).bind(user.id).first();
      const purchasedAvailable = Number(balance?.purchased_credits || 0) - Number(balance?.purchased_credits_used || 0);
      const planAvailable = Number(balance?.plan_credits || 0) - Number(balance?.plan_credits_used || 0);

      await env.DB.prepare(
        "INSERT INTO credit_transactions(id,user_id,type,source,amount,balance_after,description,paypal_order_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)"
      ).bind(tokenForPurchase(),user.id,"purchase","purchased",purchase.credits,planAvailable + purchasedAvailable,`Purchase of ${purchase.credits} credits`,orderId,now).run();

      ctx.waitUntil(logActivity(env,user.id,"purchase","purchase_completed","Credit purchase completed",{provider:"paypal",credits:purchase.credits,paypal_order_id:orderId}));
      ctx.waitUntil(logActivity(env,user.id,"credit","credits_added","Purchased credits added to account",{provider:"paypal",credits:purchase.credits}));
    }

    return Response.redirect(new URL("/dashboard/?payment=success",req.url),302);
  } catch (error) {
    return Response.redirect(new URL("/plans/?payment=error",req.url),302);
  }
}

async function paypalSubscriptionApi(req, env, ctx) {
  if (req.method !== "POST") return null;

  const user = await activityUser(req, env);
  if (!user) {
    return new Response(JSON.stringify({error:"Login required"}),{status:401,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  }

  let body;
  try { body = await req.json(); } catch (_) {
    return new Response(JSON.stringify({error:"Invalid request"}),{status:400,headers:{"Content-Type":"application/json; charset=utf-8"}});
  }

  const plan = String(body?.plan || "").toLowerCase();
  if (!["pro","premium"].includes(plan)) {
    return new Response(JSON.stringify({error:"Invalid plan"}),{status:400,headers:{"Content-Type":"application/json; charset=utf-8"}});
  }

  let paypalPlanId = null;
  try {
    const product = await env.DB.prepare(
      "SELECT paypal_price_id FROM nexauren_admin_products WHERE slug=? AND active=1 LIMIT 1"
    ).bind(plan).first();
    paypalPlanId = product?.paypal_price_id || null;
  } catch (_) {}

  if (!paypalPlanId) {
    try {
      const adminPlan = await env.DB.prepare(
        "SELECT paypal_plan_id FROM nexauren_admin_plans WHERE slug=? AND active=1 LIMIT 1"
      ).bind(plan).first();
      paypalPlanId = adminPlan?.paypal_plan_id || null;
    } catch (_) {}
  }

  if (!paypalPlanId) {
    return new Response(JSON.stringify({error:"PayPal plan is not configured"}),{status:400,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  }

  try {
    const access = await paypalToken(env);
    const base = env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
    const origin = new URL(req.url).origin;
    const response = await fetch(`${base}/v1/billing/subscriptions`,{
      method:"POST",
      headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        plan_id:paypalPlanId,
        custom_id:user.id,
        application_context:{
          brand_name:"Nexauren",
          user_action:"SUBSCRIBE_NOW",
          return_url:`${origin}/dashboard/?subscription=success`,
          cancel_url:`${origin}/plans/`
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return new Response(JSON.stringify({error:"Unable to create PayPal subscription",detail:JSON.stringify(data).slice(0,500)}),{status:502,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
    }

    const approve = data.links?.find(link => link.rel === "approve")?.href;
    if (!approve || !data.id) {
      return new Response(JSON.stringify({error:"PayPal approval link was not returned"}),{status:502,headers:{"Content-Type":"application/json; charset=utf-8"}});
    }

    ctx.waitUntil(logActivity(env,user.id,"plan","subscription_started",`Started ${plan} subscription`,{provider:"paypal",plan,paypal_subscription_id:data.id}));
    return new Response(JSON.stringify({url:approve,subscription_id:data.id}),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  } catch (error) {
    return new Response(JSON.stringify({error:"Unable to start PayPal subscription",detail:String(error?.message || error).slice(0,500)}),{status:502,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  }
}

export default {
  async fetch(req, env, ctx) {
    const pathname = new URL(req.url).pathname;

    if (pathname === "/api/activity" && req.method === "GET") {
      return activityApi(req, env);
    }

    if (pathname === "/api/paypal/order" && req.method === "POST") {
      return paypalOrderApi(req, env, ctx);
    }

    if (pathname === "/api/paypal/capture" && req.method === "GET") {
      return paypalCaptureApi(req, env, ctx);
    }

    if (pathname === "/api/paypal/subscription" && req.method === "POST") {
      return paypalSubscriptionApi(req, env, ctx);
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
const COOKIE = "nexauren_session";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });

function maxSamplesForPlan(slug) {
  if (slug === "premium") return 500;
  if (slug === "pro") return 100;
  return 20;
}

async function samplePackUser(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(
    new RegExp(`${COOKIE}=([^;]+)`)
  );

  if (!match) return null;

  return env.DB.prepare(
    "SELECT u.id,u.email,u.name " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();
}

async function samplePackLimits(req, env) {
  const user = await samplePackUser(req, env);
  if (!user) {
    return json({
      ok: false,
      error: "Login necessário"
    }, 401);
  }

  const row = await env.DB.prepare(
    "SELECT p.slug,p.name,p.monthly_credits," +
    "b.plan_credits,b.plan_credits_used," +
    "b.purchased_credits,b.purchased_credits_used " +
    "FROM subscriptions s " +
    "JOIN plans p ON p.id=s.plan_id " +
    "JOIN credit_balances b ON b.user_id=s.user_id " +
    "WHERE s.user_id=? AND s.status='active' " +
    "ORDER BY s.created_at DESC LIMIT 1"
  ).bind(user.id).first();

  const plan = String(row?.slug || "free");
  const planCredits = Math.max(
    0,
    Number(row?.plan_credits || 0) -
    Number(row?.plan_credits_used || 0)
  );
  const purchasedCredits = Math.max(
    0,
    Number(row?.purchased_credits || 0) -
    Number(row?.purchased_credits_used || 0)
  );

  return json({
    ok: true,
    plan,
    plan_name: row?.name || "Free",
    max_samples: maxSamplesForPlan(plan),
    available_credits: planCredits + purchasedCredits,
    plan_credits: planCredits,
    purchased_credits: purchasedCredits
  });
}

async function consumeSamplePack(req, env) {
  const user = await samplePackUser(req, env);
  if (!user) {
    return json({
      ok: false,
      error: "Login necessário"
    }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "Pedido inválido" }, 400);
  }

  const count = Number(body?.count);
  if (!Number.isInteger(count) || count < 1) {
    return json({ error: "Quantidade inválida" }, 400);
  }

  const row = await env.DB.prepare(
    "SELECT p.slug,p.name,b.plan_credits," +
    "b.plan_credits_used,b.purchased_credits," +
    "b.purchased_credits_used " +
    "FROM subscriptions s " +
    "JOIN plans p ON p.id=s.plan_id " +
    "JOIN credit_balances b ON b.user_id=s.user_id " +
    "WHERE s.user_id=? AND s.status='active' " +
    "ORDER BY s.created_at DESC LIMIT 1"
  ).bind(user.id).first();

  const plan = String(row?.slug || "free");
  const max = maxSamplesForPlan(plan);

  if (count > max) {
    return json({
      ok: false,
      code: "PLAN_LIMIT",
      error: `O plano ${row?.name || plan} permite até ${max} samples por geração.`,
      plan,
      max_samples: max
    }, 403);
  }

  const planAvailable = Math.max(
    0,
    Number(row?.plan_credits || 0) -
    Number(row?.plan_credits_used || 0)
  );
  const purchasedAvailable = Math.max(
    0,
    Number(row?.purchased_credits || 0) -
    Number(row?.purchased_credits_used || 0)
  );

  if (planAvailable + purchasedAvailable < count) {
    return json({
      ok: false,
      code: "INSUFFICIENT_CREDITS",
      error: "Créditos insuficientes para gerar este pack.",
      available_credits: planAvailable + purchasedAvailable,
      required_credits: count
    }, 402);
  }

  const usePlan = Math.min(planAvailable, count);
  const usePurchased = count - usePlan;
  const now = Date.now();
  const statements = [];

  if (usePlan > 0) {
    statements.push(env.DB.prepare(
      "UPDATE credit_balances SET " +
      "plan_credits_used=plan_credits_used+?," +
      "updated_at=? WHERE user_id=? " +
      "AND plan_credits-plan_credits_used>=?"
    ).bind(usePlan, now, user.id, usePlan));
  }

  if (usePurchased > 0) {
    statements.push(env.DB.prepare(
      "UPDATE credit_balances SET " +
      "purchased_credits_used=purchased_credits_used+?," +
      "updated_at=? WHERE user_id=? " +
      "AND purchased_credits-purchased_credits_used>=?"
    ).bind(usePurchased, now, user.id, usePurchased));
  }

  const results = await env.DB.batch(statements);
  const changed = results.reduce(
    (sum, result) => sum + Number(result?.meta?.changes || 0),
    0
  );

  if (changed !== statements.length) {
    return json({
      ok: false,
      code: "BALANCE_CHANGED",
      error: "O saldo de créditos mudou. Atualize a página e tente novamente."
    }, 409);
  }

  const balance = await env.DB.prepare(
    "SELECT plan_credits,plan_credits_used," +
    "purchased_credits,purchased_credits_used " +
    "FROM credit_balances WHERE user_id=? LIMIT 1"
  ).bind(user.id).first();

  const remaining = Math.max(
    0,
    Number(balance?.plan_credits || 0) -
    Number(balance?.plan_credits_used || 0) +
    Number(balance?.purchased_credits || 0) -
    Number(balance?.purchased_credits_used || 0)
  );

  await env.DB.prepare(
    "INSERT INTO credit_transactions(" +
    "id,user_id,type,source,amount,balance_after," +
    "description,paypal_order_id,created_at) " +
    "VALUES(?,?,?,?,?,?,?,?,?)"
  ).bind(
    crypto.randomUUID(),
    user.id,
    "usage",
    "sample-pack-generator",
    -count,
    remaining,
    `Sample Pack Generator: ${count} samples`,
    null,
    now
  ).run();

  return json({
    ok: true,
    consumed: count,
    remaining_credits: remaining,
    plan,
    max_samples: max
  });
}

async function handleSamplePack(req, env) {
  const path = new URL(req.url).pathname;

  if (path === "/api/tools/sample-pack/limits" &&
      req.method === "GET") {
    return samplePackLimits(req, env);
  }

  if (path === "/api/tools/sample-pack/consume" &&
      req.method === "POST") {
    return consumeSamplePack(req, env);
  }

  return null;
}

import app from "./worker-v2.js";

export default {
  async fetch(req, env, ctx) {
    const sampleResponse =
      await handleSamplePack(req, env);

    if (sampleResponse) return sampleResponse;
    return app.fetch(req, env, ctx);
  }
};

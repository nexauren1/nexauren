const COOKIE = "nexauren_session";
const TOOL_SLUG = "sample-pack-generator";
const ABSOLUTE_MAX = 500;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });

async function getToolLimit(env, planSlug) {
  const row = await env.TOOLS_DB.prepare(
    "SELECT max_usage FROM tool_plan_limits " +
    "WHERE tool_slug=? AND plan_slug=? LIMIT 1"
  ).bind(TOOL_SLUG, planSlug).first();

  return Math.min(
    ABSOLUTE_MAX,
    Math.max(0, Number(row?.max_usage ?? 20))
  );
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

async function getPlanData(userId, env) {
  return env.DB.prepare(
    "SELECT p.slug,p.name,p.monthly_credits," +
    "b.plan_credits,b.plan_credits_used," +
    "b.purchased_credits,b.purchased_credits_used " +
    "FROM subscriptions s " +
    "JOIN plans p ON p.id=s.plan_id " +
    "JOIN credit_balances b ON b.user_id=s.user_id " +
    "WHERE s.user_id=? AND s.status='active' " +
    "ORDER BY s.created_at DESC LIMIT 1"
  ).bind(userId).first();
}

function balanceData(row) {
  const plan = Math.max(
    0,
    Number(row?.plan_credits || 0) -
    Number(row?.plan_credits_used || 0)
  );

  const purchased = Math.max(
    0,
    Number(row?.purchased_credits || 0) -
    Number(row?.purchased_credits_used || 0)
  );

  return {
    plan,
    purchased,
    total: plan + purchased
  };
}

async function samplePackLimits(req, env) {
  const user = await samplePackUser(req, env);
  if (!user) {
    return json({
      ok: false,
      error: "Login necessário"
    }, 401);
  }

  const row = await getPlanData(user.id, env);
  const plan = String(row?.slug || "free");
  const includedSamples = await getToolLimit(env, plan);
  const balances = balanceData(row);

  return json({
    ok: true,
    plan,
    plan_name: row?.name || "Free",
    max_samples: ABSOLUTE_MAX,
    included_samples: includedSamples,
    available_credits: balances.total,
    plan_credits: balances.plan,
    purchased_credits: balances.purchased
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
    return json({
      ok: false,
      error: "Pedido inválido"
    }, 400);
  }

  const count = Number(body?.count);
  const creditSource = String(
    body?.credit_source || ""
  );

  if (!Number.isInteger(count) || count < 1) {
    return json({
      ok: false,
      error: "Quantidade inválida"
    }, 400);
  }

  if (count > ABSOLUTE_MAX) {
    return json({
      ok: false,
      code: "MAX_SAMPLES",
      error: `O máximo absoluto é ${ABSOLUTE_MAX} samples por geração.`,
      max_samples: ABSOLUTE_MAX
    }, 400);
  }

  const row = await getPlanData(user.id, env);
  const plan = String(row?.slug || "free");
  const includedSamples = await getToolLimit(env, plan);
  const extraSamples = Math.max(
    0,
    count - includedSamples
  );
  const balances = balanceData(row);

  if (extraSamples === 0) {
    const now = Date.now();

    try {
      await env.TOOLS_DB.prepare(
        "INSERT INTO tool_usage(" +
        "id,user_id,tool_slug,action,amount,plan_slug," +
        "credits_used,metadata,created_at) " +
        "VALUES(?,?,?,?,?,?,?,?,?)"
      ).bind(
        crypto.randomUUID(),
        user.id,
        TOOL_SLUG,
        "generate",
        count,
        plan,
        0,
        JSON.stringify({
          included_samples: includedSamples,
          extra_samples: 0,
          credit_source: null
        }),
        now
      ).run();
    } catch (_) {
      // Usage logging must not block an otherwise free generation.
    }

    return json({
      ok: true,
      consumed: 0,
      consumed_credits: 0,
      remaining_credits: balances.total,
      plan_credits: balances.plan,
      purchased_credits: balances.purchased,
      plan,
      max_samples: ABSOLUTE_MAX,
      included_samples: includedSamples,
      extra_samples: 0,
      credit_source: null
    });
  }

  if (creditSource !== "plan" &&
      creditSource !== "purchased") {
    return json({
      ok: false,
      code: "CREDIT_SOURCE_REQUIRED",
      error: "Escolha créditos do plano ou créditos comprados.",
      extra_samples: extraSamples,
      required_credits: extraSamples,
      plan_credits: balances.plan,
      purchased_credits: balances.purchased
    }, 400);
  }

  const available = creditSource === "plan"
    ? balances.plan
    : balances.purchased;

  if (available < extraSamples) {
    return json({
      ok: false,
      code: "INSUFFICIENT_CREDITS",
      error: creditSource === "plan"
        ? "Os créditos do plano não são suficientes para os samples extra."
        : "Os créditos comprados não são suficientes para os samples extra.",
      available_credits: available,
      required_credits: extraSamples,
      extra_samples: extraSamples,
      credit_source: creditSource,
      plan_credits: balances.plan,
      purchased_credits: balances.purchased
    }, 402);
  }

  const now = Date.now();
  let update;

  if (creditSource === "plan") {
    update = await env.DB.prepare(
      "UPDATE credit_balances SET " +
      "plan_credits_used=plan_credits_used+?," +
      "updated_at=? WHERE user_id=? " +
      "AND plan_credits-plan_credits_used>=?"
    ).bind(
      extraSamples,
      now,
      user.id,
      extraSamples
    ).run();
  } else {
    update = await env.DB.prepare(
      "UPDATE credit_balances SET " +
      "purchased_credits_used=purchased_credits_used+?," +
      "updated_at=? WHERE user_id=? " +
      "AND purchased_credits-purchased_credits_used>=?"
    ).bind(
      extraSamples,
      now,
      user.id,
      extraSamples
    ).run();
  }

  if (Number(update?.meta?.changes || 0) !== 1) {
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

  const finalBalances = balanceData(balance);

  try {
    await env.DB.prepare(
      "INSERT INTO credit_transactions(" +
      "id,user_id,type,source,amount,balance_after," +
      "description,paypal_order_id,created_at) " +
      "VALUES(?,?,?,?,?,?,?,?,?)"
    ).bind(
      crypto.randomUUID(),
      user.id,
      "usage",
      `${TOOL_SLUG}:${creditSource}`,
      -extraSamples,
      finalBalances.total,
      `Sample Pack Generator: ${count} samples (${extraSamples} extra)`,
      null,
      now
    ).run();
  } catch (_) {
    // The credit deduction is already protected by the conditional update.
  }

  try {
    await env.TOOLS_DB.prepare(
      "INSERT INTO tool_usage(" +
      "id,user_id,tool_slug,action,amount,plan_slug," +
      "credits_used,metadata,created_at) " +
      "VALUES(?,?,?,?,?,?,?,?,?)"
    ).bind(
      crypto.randomUUID(),
      user.id,
      TOOL_SLUG,
      "generate",
      count,
      plan,
      extraSamples,
      JSON.stringify({
        included_samples: includedSamples,
        extra_samples: extraSamples,
        credit_source: creditSource
      }),
      now
    ).run();
  } catch (_) {
    // Usage analytics should not block the generation after a valid charge.
  }

  return json({
    ok: true,
    consumed: extraSamples,
    consumed_credits: extraSamples,
    remaining_credits: finalBalances.total,
    plan_credits: finalBalances.plan,
    purchased_credits: finalBalances.purchased,
    plan,
    max_samples: ABSOLUTE_MAX,
    included_samples: includedSamples,
    extra_samples: extraSamples,
    credit_source: creditSource
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

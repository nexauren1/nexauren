const COOKIE = "nexauren_session";
const SESSION_DAYS = 7;

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });

const redirect = (url, headers = {}) =>
  new Response(null, {
    status: 302,
    headers: { Location: url, ...headers }
  });

const token = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
};

async function hash(password, salt) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password + salt)
  );

  return [...new Uint8Array(digest)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

async function currentUser(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(
    new RegExp(`${COOKIE}=([^;]+)`)
  );

  if (!match) return null;

  return env.DB
    .prepare(
      "SELECT u.id,u.email,u.name,u.role " +
      "FROM sessions s JOIN users u ON u.id=s.user_id " +
      "WHERE s.token=? AND s.expires_at>? LIMIT 1"
    )
    .bind(match[1], Date.now())
    .first();
}

async function getFreePlanId(env) {
  const plan = await env.DB
    .prepare(
      "SELECT id FROM plans WHERE slug='free' LIMIT 1"
    )
    .first();

  if (!plan?.id) {
    throw new Error("Free plan is not configured");
  }

  return plan.id;
}

async function ensureAccount(env, userId) {
  const now = Date.now();

  const balance = await env.DB
    .prepare(
      "SELECT user_id FROM credit_balances " +
      "WHERE user_id=? LIMIT 1"
    )
    .bind(userId)
    .first();

  if (!balance) {
    await env.DB
      .prepare(
        "INSERT INTO credit_balances(" +
        "user_id,plan_credits,purchased_credits," +
        "plan_credits_used,purchased_credits_used," +
        "reset_date,updated_at) VALUES(?,?,?,?,?,?,?)"
      )
      .bind(
        userId,
        100,
        0,
        0,
        0,
        now + 30 * 86400000,
        now
      )
      .run();
  }

  const sub = await env.DB
    .prepare(
      "SELECT id FROM subscriptions " +
      "WHERE user_id=? AND status='active' LIMIT 1"
    )
    .bind(userId)
    .first();

  if (!sub) {
    const freePlanId = await getFreePlanId(env);

    await env.DB
      .prepare(
        "INSERT INTO subscriptions(" +
        "id,user_id,plan_id,status,start_date," +
        "created_at,updated_at) VALUES(?,?,?,?,?,?,?)"
      )
      .bind(
        token(),
        userId,
        freePlanId,
        "active",
        now,
        now,
        now
      )
      .run();
  }
}

async function accountData(env, userId) {
  await ensureAccount(env, userId);

  const [subscription, balance, history, user] =
    await Promise.all([
      env.DB
        .prepare(
          "SELECT s.*,p.name plan_name,p.slug," +
          "p.price,p.monthly_credits " +
          "FROM subscriptions s " +
          "JOIN plans p ON p.id=s.plan_id " +
          "WHERE s.user_id=? AND s.status='active' " +
          "ORDER BY s.created_at DESC LIMIT 1"
        )
        .bind(userId)
        .first(),
      env.DB
        .prepare(
          "SELECT * FROM credit_balances " +
          "WHERE user_id=? LIMIT 1"
        )
        .bind(userId)
        .first(),
      env.DB
        .prepare(
          "SELECT type,source,amount,balance_after," +
          "description,created_at " +
          "FROM credit_transactions WHERE user_id=? " +
          "ORDER BY created_at DESC LIMIT 20"
        )
        .bind(userId)
        .all(),
      env.DB
        .prepare(
          "SELECT id,email,name,role,created_at " +
          "FROM users WHERE id=? LIMIT 1"
        )
        .bind(userId)
        .first()
    ]);

  return {
    user,
    subscription,
    balance,
    history: history.results || []
  };
}

async function createSession(env, userId) {
  const session = token();

  await env.DB
    .prepare(
      "INSERT INTO sessions(token,user_id,expires_at) " +
      "VALUES(?,?,?)"
    )
    .bind(
      session,
      userId,
      Date.now() + SESSION_DAYS * 86400000
    )
    .run();

  return json(
    { ok: true },
    200,
    {
      "Set-Cookie":
        `${COOKIE}=${session}; Max-Age=${
          SESSION_DAYS * 86400
        }; HttpOnly; Secure; SameSite=Lax; Path=/`
    }
  );
}

async function register(req, env) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (!name || name.length > 80 ||
      !email || password.length < 8) {
    return json({ error: "Invalid account details" }, 400);
  }

  const existing = await env.DB
    .prepare(
      "SELECT id FROM users WHERE email=? LIMIT 1"
    )
    .bind(email)
    .first();

  if (existing) {
    return json({
      error: "Email is already registered"
    }, 409);
  }

  const id = token();
  const salt = token();
  const passwordHash = await hash(password, salt);
  const count = await env.DB
    .prepare("SELECT COUNT(*) count FROM users")
    .first();
  const role = Number(count?.count || 0) === 0
    ? "admin"
    : "user";

  await env.DB
    .prepare(
      "INSERT INTO users(" +
      "id,email,name,password_hash,password_salt," +
      "role,status,created_at,updated_at) " +
      "VALUES(?,?,?,?,?,?,?,?,?)"
    )
    .bind(
      id,
      email,
      name,
      passwordHash,
      salt,
      role,
      "active",
      Date.now(),
      Date.now()
    )
    .run();

  await ensureAccount(env, id);
  return createSession(env, id);
}

async function login(req, env) {
  const body = await req.json();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  const user = await env.DB
    .prepare(
      "SELECT id,password_hash,password_salt " +
      "FROM users WHERE email=? LIMIT 1"
    )
    .bind(email)
    .first();

  if (!user) {
    return json({
      error: "Incorrect email or password"
    }, 401);
  }

  const passwordHash = await hash(
    password,
    user.password_salt
  );

  if (passwordHash !== user.password_hash) {
    return json({
      error: "Incorrect email or password"
    }, 401);
  }

  await ensureAccount(env, user.id);
  return createSession(env, user.id);
}

async function logout(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(
    new RegExp(`${COOKIE}=([^;]+)`)
  );

  if (match) {
    await env.DB
      .prepare("DELETE FROM sessions WHERE token=?")
      .bind(match[1])
      .run();
  }

  return json(
    { ok: true },
    200,
    {
      "Set-Cookie":
        `${COOKIE}=; Max-Age=0; HttpOnly; ` +
        "Secure; SameSite=Lax; Path=/"
    }
  );
}

async function tools(env, req) {
  const url = new URL(req.url);
  const category =
    url.searchParams.get("category") || "";

  const query = category
    ? "SELECT slug,name,description,category,tool_path,html_file " +
      "FROM tools WHERE published=1 AND category=? " +
      "ORDER BY name"
    : "SELECT slug,name,description,category,tool_path,html_file " +
      "FROM tools WHERE published=1 ORDER BY created_at DESC";

  const result = await env.DB
    .prepare(query)
    .bind(...(category ? [category] : []))
    .all();

  return json({
    tools: result.results || []
  });
}

async function paypalToken(env) {
  if (!env.PAYPAL_CLIENT_ID ||
      !env.PAYPAL_CLIENT_SECRET) {
    return null;
  }

  const base = env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";
  const auth = btoa(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  );

  const response = await fetch(
    `${base}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  if (!response.ok) {
    throw new Error("PayPal OAuth failed");
  }

  return (await response.json()).access_token;
}

async function paypalOrder(req, env) {
  const user = await currentUser(req, env);
  if (!user) {
    return json({ error: "Login required" }, 401);
  }

  const body = await req.json();
  const credits = Number(body.credits);
  const prices = {
    100: 1,
    300: 3,
    500: 5,
    1000: 10
  };
  const amount = prices[credits];

  if (!amount) {
    return json({ error: "Invalid package" }, 400);
  }

  const pkg = await env.DB
    .prepare(
      "SELECT id FROM credit_packages " +
      "WHERE credits=? AND price=? AND active=1 LIMIT 1"
    )
    .bind(credits, amount)
    .first();

  if (!pkg) {
    return json({ error: "Package not found" }, 404);
  }

  const access = await paypalToken(env);
  if (!access) {
    return json({
      error: "PayPal Sandbox is not configured"
    }, 503);
  }

  const base = env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";
  const origin = new URL(req.url).origin;

  const response = await fetch(
    `${base}/v2/checkout/orders`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: pkg.id,
          custom_id: `${user.id}|${pkg.id}`,
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2)
          },
          description:
            `${credits} Nexauren Credits`
        }],
        application_context: {
          brand_name: "Nexauren",
          user_action: "PAY_NOW",
          return_url:
            `${origin}/api/paypal/capture`,
          cancel_url: `${origin}/plans/`
        }
      })
    }
  );

  if (!response.ok) {
    return json({
      error: "Could not create the PayPal order"
    }, 502);
  }

  const data = await response.json();
  const approve = data.links?.find(
    x => x.rel === "approve"
  )?.href;

  await env.DB
    .prepare(
      "INSERT INTO credit_purchases(" +
      "id,user_id,package_id,credits,amount,status," +
      "paypal_order_id,created_at) VALUES(?,?,?,?,?,?,?,?)"
    )
    .bind(
      token(),
      user.id,
      pkg.id,
      credits,
      amount,
      "pending",
      data.id,
      Date.now()
    )
    .run();

  return json({
    url: approve,
    order_id: data.id
  });
}

async function paypalCapture(req, env) {
  const user = await currentUser(req, env);
  if (!user) return redirect("/login/");

  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  if (!orderId) return redirect("/plans/");

  const access = await paypalToken(env);
  if (!access) return redirect("/plans/?payment=error");

  const base = env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const response = await fetch(
    `${base}/v2/checkout/orders/${encodeURIComponent(
      orderId
    )}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    return redirect("/plans/?payment=not_confirmed");
  }

  const purchase = await env.DB
    .prepare(
      "SELECT * FROM credit_purchases " +
      "WHERE paypal_order_id=? AND user_id=? LIMIT 1"
    )
    .bind(orderId, user.id)
    .first();

  if (!purchase) {
    return redirect("/plans/?payment=not_found");
  }

  if (purchase.status !== "completed") {
    await env.DB
      .prepare(
        "UPDATE credit_purchases SET status='completed'," +
        "completed_at=? WHERE id=?"
      )
      .bind(Date.now(), purchase.id)
      .run();

    await env.DB
      .prepare(
        "UPDATE credit_balances SET " +
        "purchased_credits=purchased_credits+?," +
        "updated_at=? WHERE user_id=?"
      )
      .bind(
        purchase.credits,
        Date.now(),
        user.id
      )
      .run();

    await env.DB
      .prepare(
        "INSERT INTO credit_transactions(" +
        "id,user_id,type,source,amount,balance_after," +
        "description,paypal_order_id,created_at) " +
        "VALUES(?,?,?,?,?,?,?,?,?)"
      )
      .bind(
        token(),
        user.id,
        "purchase",
        "purchased",
        purchase.credits,
        0,
        `Purchase of ${purchase.credits} credits`,
        orderId,
        Date.now()
      )
      .run();
  }

  return redirect("/dashboard/?payment=success");
}

async function paypalSubscription(req, env) {
  const user = await currentUser(req, env);
  if (!user) {
    return json({ error: "Login required" }, 401);
  }

  const body = await req.json();
  const planSlug = String(body?.plan_slug || "")
    .trim()
    .toLowerCase();

  const adminPlan = await env.DB
    .prepare(
      "SELECT * FROM plans " +
      "WHERE slug=? AND active=1 LIMIT 1"
    )
    .bind(planSlug)
    .first();

  if (!adminPlan?.paypal_plan_id) {
    return json({
      error: "PayPal plan is not configured"
    }, 404);
  }

  const access = await paypalToken(env);
  if (!access) {
    return json({
      error: "PayPal Sandbox is not configured"
    }, 503);
  }

  const base = env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";
  const origin = new URL(req.url).origin;

  const response = await fetch(
    `${base}/v1/billing/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan_id: adminPlan.paypal_plan_id,
        custom_id: user.id,
        application_context: {
          brand_name: "Nexauren",
          user_action: "SUBSCRIBE_NOW",
          return_url:
            `${origin}/dashboard/?subscription=success`,
          cancel_url: `${origin}/plans/`
        }
      })
    }
  );

  if (!response.ok) {
    return json({
      error: "Could not create the PayPal subscription"
    }, 502);
  }

  const data = await response.json();
  const approve = data.links?.find(
    x => x.rel === "approve"
  )?.href;

  return json({
    url: approve,
    subscription_id: data.id
  });
}

import { adminRouter } from "./admin.js";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith("/admin")) {
      const adminResponse =
        await adminRouter(req, env);
      if (adminResponse) return adminResponse;
    }

    try {
      if (path === "/api/auth/me" &&
          req.method === "GET") {
        const user = await currentUser(req, env);
        return user
          ? json({ ok: true, user })
          : json({ ok: false, user: null }, 401);
      }

      if (path === "/api/auth/register" &&
          req.method === "POST") {
        return register(req, env);
      }

      if (path === "/api/auth/login" &&
          req.method === "POST") {
        return login(req, env);
      }

      if (path === "/api/auth/logout" &&
          req.method === "POST") {
        return logout(req, env);
      }

      if (path === "/api/account" &&
          req.method === "GET") {
        const user = await currentUser(req, env);
        if (!user) {
          return json({ error: "Login required" }, 401);
        }
        return json(await accountData(env, user.id));
      }

      if (path === "/api/tools" &&
          req.method === "GET") {
        return tools(env, req);
      }

      if (path === "/api/paypal/order" &&
          req.method === "POST") {
        return paypalOrder(req, env);
      }

      if (path === "/api/paypal/subscription" &&
          req.method === "POST") {
        return paypalSubscription(req, env);
      }

      if (path === "/api/paypal/capture" &&
          req.method === "GET") {
        return paypalCapture(req, env);
      }

      return env.ASSETS.fetch(req);
    } catch (error) {
      return json({
        error: "Internal server error",
        detail: String(error?.message || error)
      }, 500);
    }
  }
};
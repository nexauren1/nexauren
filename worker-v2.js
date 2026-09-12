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

const token = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
};

async function hash(password, salt) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password + salt)
  );
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function getFreePlanId(env) {
  const plan = await env.DB.prepare(
    "SELECT id FROM plans WHERE slug='free' LIMIT 1"
  ).first();
  if (!plan?.id) throw new Error("Free plan is not configured");
  return plan.id;
}

async function ensureAccount(env, userId) {
  const now = Date.now();
  const balance = await env.DB.prepare(
    "SELECT user_id FROM credit_balances WHERE user_id=? LIMIT 1"
  ).bind(userId).first();

  if (!balance) {
    await env.DB.prepare(
      "INSERT INTO credit_balances(user_id,plan_credits,purchased_credits,plan_credits_used,purchased_credits_used,reset_date,updated_at) VALUES(?,?,?,?,?,?,?)"
    ).bind(userId, 100, 0, 0, 0, now + 30 * 86400000, now).run();
  }

  const sub = await env.DB.prepare(
    "SELECT id FROM subscriptions WHERE user_id=? AND status='active' LIMIT 1"
  ).bind(userId).first();

  if (!sub) {
    const freePlanId = await getFreePlanId(env);
    await env.DB.prepare(
      "INSERT INTO subscriptions(id,user_id,plan_id,status,start_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)"
    ).bind(token(), userId, freePlanId, "active", now, now, now).run();
  }
}

async function createSession(env, userId) {
  const session = token();
  await env.DB.prepare(
    "INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)"
  ).bind(session, userId, Date.now() + SESSION_DAYS * 86400000).run();

  return json({ ok: true }, 200, {
    "Set-Cookie": `${COOKIE}=${session}; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax; Path=/`
  });
}

async function register(req, env) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name || name.length > 80 || !email || password.length < 8) {
    return json({ error: "Invalid account details" }, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE email=? LIMIT 1"
  ).bind(email).first();

  if (existing) {
    return json({ error: "Email is already registered" }, 409);
  }

  const id = token();
  const salt = token();
  const passwordHash = await hash(password, salt);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) count FROM users"
  ).first();
  const role = Number(count?.count || 0) === 0 ? "admin" : "user";
  const now = Date.now();

  // IMPORTANT: the real users table has no status or updated_at columns.
  await env.DB.prepare(
    "INSERT INTO users(id,email,name,password_hash,password_salt,role,created_at) VALUES(?,?,?,?,?,?,?)"
  ).bind(id, email, name, passwordHash, salt, role, now).run();

  await ensureAccount(env, id);
  return createSession(env, id);
}

async function login(req, env) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = await env.DB.prepare(
    "SELECT id,password_hash,password_salt FROM users WHERE email=? LIMIT 1"
  ).bind(email).first();

  if (!user) return json({ error: "Incorrect email or password" }, 401);

  const passwordHash = await hash(password, user.password_salt);
  if (passwordHash !== user.password_hash) {
    return json({ error: "Incorrect email or password" }, 401);
  }

  await ensureAccount(env, user.id);
  return createSession(env, user.id);
}

async function currentUser(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return null;
  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();
}

async function logout(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (match) await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(match[1]).run();
  return json({ ok: true }, 200, {
    "Set-Cookie": `${COOKIE}=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/`
  });
}

async function accountData(env, userId) {
  await ensureAccount(env, userId);
  const [subscription, balance, history, user] = await Promise.all([
    env.DB.prepare(
      "SELECT s.*,p.name plan_name,p.slug,p.price,p.monthly_credits FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status='active' ORDER BY s.created_at DESC LIMIT 1"
    ).bind(userId).first(),
    env.DB.prepare("SELECT * FROM credit_balances WHERE user_id=? LIMIT 1").bind(userId).first(),
    env.DB.prepare(
      "SELECT type,source,amount,balance_after,description,created_at FROM credit_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 20"
    ).bind(userId).all(),
    env.DB.prepare(
      "SELECT id,email,name,role,created_at FROM users WHERE id=? LIMIT 1"
    ).bind(userId).first()
  ]);
  return { user, subscription, balance, history: history.results || [] };
}

async function tools(env, req) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || "";
  const query = category
    ? "SELECT slug,name,description,category,tool_path,html_file FROM tools WHERE published=1 AND category=? ORDER BY name"
    : "SELECT slug,name,description,category,tool_path,html_file FROM tools WHERE published=1 ORDER BY created_at DESC";
  const result = await env.DB.prepare(query).bind(...(category ? [category] : [])).all();
  return json({ tools: result.results || [] });
}

async function paypalToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return null;
  const base = env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error("PayPal OAuth failed");
  return (await response.json()).access_token;
}

export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      if (url.pathname === "/api/register" && req.method === "POST") return register(req, env);
      if (url.pathname === "/api/login" && req.method === "POST") return login(req, env);
      if (url.pathname === "/api/logout" && req.method === "POST") return logout(req, env);
      if (url.pathname === "/api/account" && req.method === "GET") {
        const user = await currentUser(req, env);
        if (!user) return json({ error: "Login required" }, 401);
        return json(await accountData(env, user.id));
      }
      if (url.pathname === "/api/tools" && req.method === "GET") return tools(env, req);
      return env.ASSETS.fetch(req);
    } catch (error) {
      return json({ error: "Internal server error", detail: String(error?.message || error) }, 500);
    }
  }
};

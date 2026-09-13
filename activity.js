const COOKIE = "nexauren_session";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function activityUser(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return null;

  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();
}

export async function logActivity(env, userId, type, action, description = "", metadata = {}) {
  if (!userId) return;

  try {
    await env.DB.prepare(
      "INSERT INTO activity_logs(" +
      "id,user_id,type,action,description,metadata,created_at) " +
      "VALUES(?,?,?,?,?,?,?)"
    ).bind(
      crypto.randomUUID(),
      userId,
      type,
      action,
      description,
      JSON.stringify(metadata || {}),
      Date.now()
    ).run();
  } catch (error) {
    console.error("Activity log error", error?.message || error);
  }
}

export async function activityApi(req, env) {
  const user = await activityUser(req, env);
  if (!user) {
    return json({ ok: false, error: "Login required" }, 401);
  }

  const url = new URL(req.url);
  const type = String(url.searchParams.get("type") || "").trim();
  const allowedTypes = [
    "account",
    "tool",
    "credit",
    "purchase",
    "plan",
    "security"
  ];

  const limitRaw = Number(url.searchParams.get("limit") || 50);
  const limit = Math.min(
    100,
    Math.max(1, Number.isInteger(limitRaw) ? limitRaw : 50)
  );

  let result;

  if (type && allowedTypes.includes(type)) {
    result = await env.DB.prepare(
      "SELECT id,type,action,description,metadata,created_at " +
      "FROM activity_logs WHERE user_id=? AND type=? " +
      "ORDER BY created_at DESC LIMIT ?"
    ).bind(user.id, type, limit).all();
  } else {
    result = await env.DB.prepare(
      "SELECT id,type,action,description,metadata,created_at " +
      "FROM activity_logs WHERE user_id=? " +
      "ORDER BY created_at DESC LIMIT ?"
    ).bind(user.id, limit).all();
  }

  return json({
    ok: true,
    activities: (result.results || []).map(item => ({
      ...item,
      metadata: (() => {
        try {
          return JSON.parse(item.metadata || "{}");
        } catch (_) {
          return {};
        }
      })()
    }))
  });
}

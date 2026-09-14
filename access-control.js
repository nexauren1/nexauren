const PLANS = {
  free: 0,
  pro: 1,
  premium: 2
};

function normalizePlan(value) {
  const plan = String(value || "free").toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLANS, plan)
    ? plan
    : "free";
}

export function planRank(plan) {
  return PLANS[normalizePlan(plan)];
}

export async function getToolPlan(env, userId) {
  if (!userId) return "free";

  try {
    const row = await env.DB.prepare(
      "SELECT p.slug FROM subscriptions s " +
      "JOIN plans p ON p.id=s.plan_id " +
      "WHERE s.user_id=? AND s.status='active' AND p.active=1 " +
      "ORDER BY s.created_at DESC LIMIT 1"
    ).bind(userId).first();

    return normalizePlan(row?.slug);
  } catch (_) {
    return "free";
  }
}

export async function getToolFeature(env, toolSlug, featureKey) {
  if (!env.TOOLS_DB) return null;

  return env.TOOLS_DB.prepare(
    "SELECT id,tool_slug,feature_key,name,description,required_plan,active " +
    "FROM tool_features " +
    "WHERE tool_slug=? AND feature_key=? AND active=1 LIMIT 1"
  ).bind(toolSlug, featureKey).first();
}

export async function checkToolFeature(env, userId, toolSlug, featureKey) {
  const feature = await getToolFeature(env, toolSlug, featureKey);
  if (!feature) {
    return {
      ok: false,
      code: "FEATURE_NOT_CONFIGURED",
      error: "This tool feature is not configured."
    };
  }

  const plan = await getToolPlan(env, userId);
  const required = normalizePlan(feature.required_plan);

  return {
    ok: planRank(plan) >= planRank(required),
    plan,
    required_plan: required,
    feature
  };
}

export function upgradeRequired(result) {
  return {
    ok: false,
    code: "UPGRADE_REQUIRED",
    required_plan: result.required_plan,
    error: `${result.feature?.name || "This feature"} requires ${result.required_plan}.`
  };
}

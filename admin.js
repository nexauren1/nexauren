const AESC = (v) => String(v ?? "").replace(/[&<>\"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[c]));

const AJSON = (data, status = 200) => new Response(
  JSON.stringify(data),
  {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  }
);

const ARE = (url) => new Response(null, {
  status: 302,
  headers: { Location: url }
});

const AID = () => crypto.randomUUID();

async function adminUser(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const m = cookie.match(/nexauren_session=([^;]+)/);
  if (!m) return null;

  return env.DB.prepare(`
    SELECT u.id, u.email, u.name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
      AND s.expires_at > ?
    LIMIT 1
  `).bind(m[1], Date.now()).first();
}

async function isAdmin(req, env) {
  const u = await adminUser(req, env);
  const email = String(env.ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();

  return !!(
    u &&
    email &&
    String(u.email || "").trim().toLowerCase() === email
  );
}

async function ensureAdminTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS nexauren_admin_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'credits',
        credits INTEGER NOT NULL DEFAULT 0,
        paypal_product_id TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS nexauren_admin_plans (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        monthly_credits INTEGER NOT NULL DEFAULT 0,
        paypal_product_id TEXT DEFAULT '',
        paypal_plan_id TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  ]);
}

async function paypalToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "PAYPAL_CLIENT_ID e PAYPAL_CLIENT_SECRET não estão configurados."
    );
  }

  const base = env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const auth = btoa(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  );

  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`PayPal OAuth falhou: ${text.slice(0, 500)}`);
  }

  return (await r.json()).access_token;
}

async function paypalCreateProduct(env, data) {
  const access = await paypalToken(env);
  const base = env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const r = await fetch(`${base}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      "PayPal-Request-Id": `NEXAUREN-PRODUCT-${AID()}`
    },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      type: "SERVICE",
      category: "SOFTWARE",
      home_url: "https://nexaurenstory.com"
    })
  });

  const result = await r.json().catch(() => ({}));

  if (!r.ok || !result.id) {
    throw new Error(
      result?.message ||
      result?.details?.[0]?.description ||
      "PayPal não criou o produto."
    );
  }

  return result;
}

async function paypalCreatePlan(env, data) {
  const access = await paypalToken(env);
  const base = env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("O preço do plano deve ser maior que zero.");
  }

  const r = await fetch(`${base}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `NEXAUREN-PLAN-${AID()}`
    },
    body: JSON.stringify({
      product_id: data.productId,
      name: data.name,
      description: data.description,
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: price.toFixed(2),
              currency_code: "USD"
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 1
      }
    })
  });

  const result = await r.json().catch(() => ({}));

  if (!r.ok || !result.id) {
    throw new Error(
      result?.message ||
      result?.details?.[0]?.description ||
      "PayPal não criou o plano."
    );
  }

  return result;
}

async function paypalSubscriptionSuccess(req, env) {
  const u = await adminUser(req, env);
  if (!u) return ARE("/login");

  const url = new URL(req.url);
  const subscriptionId =
    url.searchParams.get("subscription_id");

  if (!subscriptionId) {
    return ARE("/plans?payment=missing");
  }

  try {
    const access = await paypalToken(env);
    const base = env.PAYPAL_BASE_URL ||
      "https://api-m.sandbox.paypal.com";

    const r = await fetch(
      `${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!r.ok) {
      return ARE("/plans?payment=not_confirmed");
    }

    const data = await r.json();

    if (data.status !== "ACTIVE") {
      return ARE("/plans?payment=not_active");
    }

    if (
      data.custom_id &&
      String(data.custom_id) !== String(u.id)
    ) {
      return ARE("/plans?payment=invalid_user");
    }

    const adminPlan = await env.DB
      .prepare(`
        SELECT slug
        FROM nexauren_admin_plans
        WHERE paypal_plan_id = ?
          AND active = 1
        LIMIT 1
      `)
      .bind(data.plan_id)
      .first();

    if (!adminPlan?.slug) {
      return ARE("/plans?payment=plan_not_found");
    }

    const localPlan = await env.DB
      .prepare(
        "SELECT id FROM plans WHERE slug=? LIMIT 1"
      )
      .bind(adminPlan.slug)
      .first();

    if (!localPlan?.id) {
      return ARE("/plans?payment=local_plan_not_found");
    }

    const now = Date.now();
    const startDate = data.start_time
      ? Date.parse(data.start_time)
      : now;
    const endDate =
      data.billing_info?.next_billing_time
        ? Date.parse(
            data.billing_info.next_billing_time
          )
        : null;

    const existing = await env.DB
      .prepare(
        "SELECT id FROM subscriptions " +
        "WHERE user_id=? AND status='active' LIMIT 1"
      )
      .bind(u.id)
      .first();

    if (existing) {
      await env.DB
        .prepare(`
          UPDATE subscriptions
          SET plan_id=?,
              status='active',
              paypal_subscription_id=?,
              paypal_plan_id=?,
              start_date=?,
              end_date=?,
              cancelled_at=NULL,
              updated_at=?
          WHERE id=?
        `)
        .bind(
          localPlan.id,
          subscriptionId,
          data.plan_id,
          startDate,
          endDate,
          now,
          existing.id
        )
        .run();
    } else {
      await env.DB
        .prepare(`
          INSERT INTO subscriptions(
            id,user_id,plan_id,status,
            paypal_subscription_id,paypal_plan_id,
            start_date,end_date,created_at,updated_at
          )
          VALUES(?,?,?,?,?,?,?,?,?,?)
        `)
        .bind(
          AID(),
          u.id,
          localPlan.id,
          "active",
          subscriptionId,
          data.plan_id,
          startDate,
          endDate,
          now,
          now
        )
        .run();
    }

    return ARE(
      `/dashboard?payment=subscription_success&plan=${encodeURIComponent(adminPlan.slug)}`
    );
  } catch (e) {
    return ARE("/plans?payment=paypal_error");
  }
}

function adminShell(body, title) {
  return new Response(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${AESC(title)} | Nexauren Admin</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#101828;background:#f6f8fc;--blue:#2563eb;--violet:#7c3aed;--line:#e5e7eb;--muted:#667085;--gold:#b7791f}
*{box-sizing:border-box}body{margin:0}a{text-decoration:none;color:inherit}
.top{height:68px;background:#101828;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 max(18px,5vw)}
.brand{font-weight:950;letter-spacing:.08em}.topnav{display:flex;gap:8px;align-items:center}.topnav a{background:#ffffff12;color:#fff;padding:9px 12px;border-radius:9px;font-weight:750}
.wrap{width:min(1180px,94vw);margin:auto;padding:32px 0 60px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 12px 35px #1018280a}.muted{color:var(--muted)}.num{font-size:32px;font-weight:950;margin-top:7px}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px}.tab{padding:10px 14px;border-radius:10px;background:#fff;border:1px solid var(--line);font-weight:800}.tab.active{background:#101828;color:#fff}
.formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}.field label{font-weight:800;font-size:14px}
.field input,.field select{padding:12px 13px;border:1px solid #d7dce5;border-radius:11px;font:inherit;background:#fff}.btn{display:inline-flex;border:0;border-radius:11px;padding:12px 16px;font:inherit;font-weight:850;cursor:pointer}.primary{background:linear-gradient(135deg,var(--blue),var(--violet));color:#fff}.gold{background:#f5b942;color:#3b2a00}
.tablewrap{overflow:auto}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:12px;border-bottom:1px solid #edf0f5;white-space:nowrap}.pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:#eff6ff;color:var(--blue);font-size:12px;font-weight:850}
.notice{padding:13px 15px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;color:#92400e;margin-bottom:18px}.success{background:#ecfdf3;border-color:#abefc6;color:#067647}.sectionhead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
@media(max-width:850px){.grid{grid-template-columns:repeat(2,1fr)}.formgrid{grid-template-columns:1fr}}@media(max-width:560px){.grid{grid-template-columns:1fr}.wrap{padding-top:20px}.topnav a{display:none}}
</style>
</head>
<body>
<header class="top">
<a class="brand" href="/admin">NEXAUREN ADMIN</a>
<nav class="topnav">
<a href="/admin">Visão geral</a>
<a href="/admin/products">Produtos</a>
<a href="/admin/plans">Planos</a>
<a href="/dashboard">Site</a>
</nav>
</header>
${body}
</body>
</html>`, {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

async function dashboard(env) {
  const [users, tools, products, plans] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) n FROM users").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM tools WHERE published=1").first(),
    env.DB.prepare(
      "SELECT COUNT(*) n FROM nexauren_admin_products WHERE active=1"
    ).first(),
    env.DB.prepare(
      "SELECT COUNT(*) n FROM nexauren_admin_plans WHERE active=1"
    ).first()
  ]);

  return adminShell(`
<main class="wrap">
<div class="sectionhead">
<div><span class="pill">ADMINISTRADOR</span><h1>Painel Nexauren</h1>
<p class="muted">Produtos e planos PayPal.</p></div>
</div>
<div class="grid">
<section class="card"><div class="muted">Usuários</div><div class="num">${Number(users?.n || 0).toLocaleString()}</div></section>
<section class="card"><div class="muted">Ferramentas</div><div class="num">${Number(tools?.n || 0).toLocaleString()}</div></section>
<section class="card"><div class="muted">Produtos</div><div class="num">${Number(products?.n || 0).toLocaleString()}</div></section>
<section class="card"><div class="muted">Planos</div><div class="num">${Number(plans?.n || 0).toLocaleString()}</div></section>
</div>
<div class="grid" style="margin-top:18px;grid-template-columns:repeat(2,1fr)">
<section class="card"><h2>Produtos PayPal</h2><p class="muted">Crie o produto no PayPal e guarde o Product ID.</p><a class="btn gold" href="/admin/products">Abrir produtos</a></section>
<section class="card"><h2>Planos PayPal</h2><p class="muted">Use um Product ID para criar o plano recorrente e guardar o Plan ID.</p><a class="btn primary" href="/admin/plans">Abrir planos</a></section>
</div>
</main>`, "Admin");
}

async function productsPage(req, env) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const success = url.searchParams.get("success");

  if (req.method === "POST") {
    const f = await req.formData();
    const action = String(f.get("action") || "save");
    const id = String(f.get("id") || "").trim() || AID();
    const name = String(f.get("name") || "").trim();
    const slug = String(f.get("slug") || "").trim().toLowerCase();
    const credits = Number(f.get("credits") || 0);

    if (!name || !slug || !Number.isInteger(credits) || credits < 0) {
      return ARE("/admin/products?error=Dados+do+produto+inválidos");
    }

    if (action === "create_paypal_product") {
      try {
        const existing = await env.DB.prepare(
          "SELECT paypal_product_id FROM nexauren_admin_products WHERE slug=? LIMIT 1"
        ).bind(slug).first();

        if (existing?.paypal_product_id) {
          return ARE("/admin/products?error=Este+produto+já+tem+PayPal+Product+ID");
        }

        const product = await paypalCreateProduct(env, {
          name,
          description: `${credits} créditos Nexauren`
        });

        const now = Date.now();
        await env.DB.prepare(`
          INSERT INTO nexauren_admin_products (
            id,name,slug,type,credits,paypal_product_id,active,created_at,updated_at
          ) VALUES (?,?,?,?,?,?,1,?,?)
          ON CONFLICT(slug) DO UPDATE SET
            name=excluded.name,
            credits=excluded.credits,
            paypal_product_id=excluded.paypal_product_id,
            active=1,
            updated_at=excluded.updated_at
        `).bind(
          id,
          name,
          slug,
          "credits",
          credits,
          product.id,
          now,
          now
        ).run();

        return ARE(
          `/admin/products?success=${encodeURIComponent(
            `Produto criado no PayPal: ${product.id}`
          )}`
        );
      } catch (e) {
        return ARE(`/admin/products?error=${encodeURIComponent(String(e.message || e))}`);
      }
    }

    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO nexauren_admin_products (
        id,name,slug,type,credits,paypal_product_id,active,created_at,updated_at
      ) VALUES (?,?,?,?,?,'',1,?,?)
      ON CONFLICT(slug) DO UPDATE SET
        name=excluded.name,
        credits=excluded.credits,
        active=1,
        updated_at=excluded.updated_at
    `).bind(id, name, slug, "credits", credits, now, now).run();

    return ARE("/admin/products?success=Produto+guardado");
  }

  const rows = await env.DB.prepare(
    "SELECT * FROM nexauren_admin_products ORDER BY created_at DESC"
  ).all();

  return adminShell(`
<main class="wrap">
<div class="tabs">
<a class="tab" href="/admin">Visão geral</a>
<a class="tab active" href="/admin/products">Produtos</a>
<a class="tab" href="/admin/plans">Planos</a>
</div>
<div class="sectionhead"><div><h1>Produtos PayPal</h1>
<p class="muted">Primeiro crie o produto no PayPal. O ID retornado fica salvo aqui.</p></div></div>
${success ? `<div class="notice success">${AESC(success)}</div>` : ""}
${error ? `<div class="notice">${AESC(error)}</div>` : ""}
<section class="card">
<h2>Criar produto</h2>
<form method="post" class="formgrid">
<div class="field"><label>Nome</label><input name="name" required placeholder="Nexauren 100 Credits"></div>
<div class="field"><label>Slug</label><input name="slug" required placeholder="credits_100"></div>
<div class="field"><label>Créditos</label><input name="credits" type="number" min="0" step="1" required placeholder="100"></div>
<div class="field full">
<button class="btn gold" name="action" value="create_paypal_product" type="submit">Criar produto no PayPal</button>
</div>
</form>
</section>
<section class="card" style="margin-top:18px">
<h2>Produtos cadastrados</h2>
<div class="tablewrap"><table class="table">
<thead><tr><th>Nome</th><th>Slug</th><th>Créditos</th><th>PayPal Product ID</th><th>Status</th></tr></thead>
<tbody>
${rows.results.map(r => `<tr>
<td>${AESC(r.name)}</td><td>${AESC(r.slug)}</td>
<td>${Number(r.credits).toLocaleString()}</td>
<td><b>${AESC(r.paypal_product_id || "—")}</b></td>
<td>${r.active ? "Ativo" : "Inativo"}</td>
</tr>`).join("") || `<tr><td colspan="5" class="muted">Nenhum produto.</td></tr>`}
</tbody></table></div>
</section>
</main>`, "Produtos");
}

async function plansPage(req, env) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const success = url.searchParams.get("success");

  if (req.method === "POST") {
    const f = await req.formData();
    const action = String(f.get("action") || "save");
    const id = String(f.get("id") || "").trim() || AID();
    const slug = String(f.get("slug") || "").trim().toLowerCase();
    const name = String(f.get("name") || "").trim();
    const price = Number(f.get("price") || 0);
    const monthly = Number(f.get("monthly_credits") || 0);
    const productId = String(f.get("paypal_product_id") || "").trim();

    if (
      !slug ||
      !name ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(monthly) ||
      monthly < 0 ||
      !productId
    ) {
      return ARE("/admin/plans?error=Dados+do+plano+inválidos");
    }

    if (action === "create_paypal_plan") {
      try {
        const existing = await env.DB.prepare(
          "SELECT paypal_plan_id FROM nexauren_admin_plans WHERE slug=? LIMIT 1"
        ).bind(slug).first();

        if (existing?.paypal_plan_id) {
          return ARE("/admin/plans?error=Este+plano+já+tem+PayPal+Plan+ID");
        }

        const plan = await paypalCreatePlan(env, {
          productId,
          name,
          price,
          description: `${name} — ${monthly} créditos por mês`
        });

        const now = Date.now();

        await env.DB.prepare(`
          INSERT INTO nexauren_admin_plans (
            id,slug,name,price,monthly_credits,
            paypal_product_id,paypal_plan_id,active,created_at,updated_at
          ) VALUES (?,?,?,?,?,?,?,1,?,?)
          ON CONFLICT(slug) DO UPDATE SET
            name=excluded.name,
            price=excluded.price,
            monthly_credits=excluded.monthly_credits,
            paypal_product_id=excluded.paypal_product_id,
            paypal_plan_id=excluded.paypal_plan_id,
            active=1,
            updated_at=excluded.updated_at
        `).bind(
          id,
          slug,
          name,
          price,
          monthly,
          productId,
          plan.id,
          now,
          now
        ).run();

        await env.DB.prepare(`
          INSERT INTO plans (
            id,slug,name,price,monthly_credits,created_at,updated_at
          ) VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            slug=excluded.slug,
            name=excluded.name,
            price=excluded.price,
            monthly_credits=excluded.monthly_credits,
            updated_at=excluded.updated_at
        `).bind(
          slug,
          slug,
          name,
          price,
          monthly,
          now,
          now
        ).run();

        return ARE(
          `/admin/plans?success=${encodeURIComponent(
            `Plano criado no PayPal: ${plan.id}`
          )}`
        );
      } catch (e) {
        return ARE(`/admin/plans?error=${encodeURIComponent(String(e.message || e))}`);
      }
    }

    return ARE("/admin/plans?error=Use+o+botão+Criar+plano+no+PayPal");
  }

  const [rows, products] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM nexauren_admin_plans ORDER BY price ASC, created_at ASC"
    ).all(),
    env.DB.prepare(
      "SELECT name,slug,paypal_product_id FROM nexauren_admin_products WHERE active=1 AND paypal_product_id!='' ORDER BY name"
    ).all()
  ]);

  return adminShell(`
<main class="wrap">
<div class="tabs">
<a class="tab" href="/admin">Visão geral</a>
<a class="tab" href="/admin/products">Produtos</a>
<a class="tab active" href="/admin/plans">Planos</a>
</div>
<div class="sectionhead"><div><h1>Planos PayPal</h1>
<p class="muted">Escolha um Product ID existente e crie o plano mensal. O PayPal retorna o Plan ID.</p></div></div>
${success ? `<div class="notice success">${AESC(success)}</div>` : ""}
${error ? `<div class="notice">${AESC(error)}</div>` : ""}
<section class="card">
<h2>Criar plano</h2>
<form method="post" class="formgrid">
<div class="field"><label>Slug</label><input name="slug" required placeholder="pro"></div>
<div class="field"><label>Nome</label><input name="name" required placeholder="Nexauren Pro"></div>
<div class="field"><label>Preço mensal (USD)</label><input name="price" type="number" step="0.01" min="0.01" required placeholder="4.99"></div>
<div class="field"><label>Créditos mensais</label><input name="monthly_credits" type="number" min="0" step="1" required placeholder="500"></div>
<div class="field full"><label>Produto PayPal</label>
<select name="paypal_product_id" required>
<option value="">Selecione o produto</option>
${products.results.map(p => `<option value="${AESC(p.paypal_product_id)}">${AESC(p.name)} — ${AESC(p.paypal_product_id)}</option>`).join("")}
</select>
</div>
<div class="field full">
<button class="btn primary" name="action" value="create_paypal_plan" type="submit">Criar plano no PayPal</button>
</div>
</form>
</section>
<section class="card" style="margin-top:18px">
<h2>Planos cadastrados</h2>
<div class="tablewrap"><table class="table">
<thead><tr><th>Plano</th><th>Preço/mês</th><th>Créditos</th><th>Product ID</th><th>Plan ID</th><th>Status</th></tr></thead>
<tbody>
${rows.results.map(r => `<tr>
<td>${AESC(r.name)}</td>
<td>$${Number(r.price).toFixed(2)}</td>
<td>${Number(r.monthly_credits).toLocaleString()}</td>
<td>${AESC(r.paypal_product_id || "—")}</td>
<td><b>${AESC(r.paypal_plan_id || "—")}</b></td>
<td>${r.active ? "Ativo" : "Inativo"}</td>
</tr>`).join("") || `<tr><td colspan="6" class="muted">Nenhum plano.</td></tr>`}
</tbody></table></div>
</section>
</main>`, "Planos");
}

export async function adminRouter(req, env) {
  const p = new URL(req.url).pathname;

  if (p === "/dashboard") {
    const subscriptionId =
      new URL(req.url).searchParams.get(
        "subscription_id"
      );

    if (subscriptionId) {
      return paypalSubscriptionSuccess(req, env);
    }
  }

  if (!p.startsWith("/admin")) return null;

  if (!(await isAdmin(req, env))) {
    return new Response("Acesso administrativo não autorizado.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=UTF-8" }
    });
  }

  await ensureAdminTables(env);

  if (p === "/admin" || p === "/admin/") {
    return dashboard(env);
  }

  if (p === "/admin/products" || p === "/admin/products/") {
    return productsPage(req, env);
  }

  if (p === "/admin/plans" || p === "/admin/plans/") {
    return plansPage(req, env);
  }

  return new Response("Admin não encontrado.", { status: 404 });
}

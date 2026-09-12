const AESC = (v) => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const AJSON = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json; charset=UTF-8","Cache-Control":"no-store"}});
const ARE = (url) => new Response(null,{status:302,headers:{Location:url}});
const AID = () => crypto.randomUUID();

async function adminUser(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const m = cookie.match(/nexauren_session=([^;]+)/);
  if (!m) return null;
  return env.DB.prepare("SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? LIMIT 1").bind(m[1], Date.now()).first();
}

async function isAdmin(req, env) {
  const u = await adminUser(req, env);
  const email = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  return !!(u && email && String(u.email || "").trim().toLowerCase() === email);
}

async function ensureAdminTables(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS nexauren_admin_products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'credits',
      price REAL NOT NULL DEFAULT 0, credits INTEGER NOT NULL DEFAULT 0, paypal_product_id TEXT DEFAULT '', paypal_price_id TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS nexauren_admin_plans (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, monthly_credits INTEGER NOT NULL DEFAULT 0,
      paypal_product_id TEXT DEFAULT '', paypal_plan_id TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`)
  ]);
}

function adminShell(body, title) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${AESC(title)} | Nexauren Admin</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#101828;background:#f6f8fc;--blue:#2563eb;--violet:#7c3aed;--line:#e5e7eb;--muted:#667085;--gold:#b7791f}*{box-sizing:border-box}body{margin:0}a{text-decoration:none;color:inherit}.top{height:68px;background:#101828;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 max(18px,5vw)}.brand{font-weight:950;letter-spacing:.08em}.topnav{display:flex;gap:8px;align-items:center}.topnav a,.topnav button{border:0;background:#ffffff12;color:#fff;padding:9px 12px;border-radius:9px;font:inherit;cursor:pointer}.wrap{width:min(1180px,94vw);margin:auto;padding:32px 0 60px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 12px 35px #1018280a}.muted{color:var(--muted)}.num{font-size:32px;font-weight:950;margin-top:7px}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px}.tab{padding:10px 14px;border-radius:10px;background:#fff;border:1px solid var(--line);font-weight:800}.tab.active{background:#101828;color:#fff}.formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}.field label{font-weight:800;font-size:14px}.field input,.field select{padding:12px 13px;border:1px solid #d7dce5;border-radius:11px;font:inherit;background:#fff}.btn{display:inline-flex;border:0;border-radius:11px;padding:12px 16px;font:inherit;font-weight:850;cursor:pointer}.primary{background:linear-gradient(135deg,var(--blue),var(--violet));color:#fff}.gold{background:#f5b942;color:#3b2a00}.tablewrap{overflow:auto}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:12px;border-bottom:1px solid #edf0f5;white-space:nowrap}.pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:#eff6ff;color:var(--blue);font-size:12px;font-weight:850}.danger{color:#b42318}.notice{padding:13px 15px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;color:#92400e;margin-bottom:18px}.sectionhead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.sectionhead h1,.sectionhead h2{margin:0}@media(max-width:850px){.grid{grid-template-columns:repeat(2,1fr)}.formgrid{grid-template-columns:1fr}}@media(max-width:560px){.grid{grid-template-columns:1fr}.wrap{padding-top:20px}.topnav a{display:none}}
</style></head><body><header class="top"><a class="brand" href="/admin">NEXAUREN ADMIN</a><nav class="topnav"><a href="/admin">Visão geral</a><a href="/admin/products">Produtos</a><a href="/admin/plans">Planos</a><a href="/dashboard">Site</a></nav></header>${body}</body></html>`,{headers:{"Content-Type":"text/html; charset=UTF-8"}});
}

async function dashboard(env) {
  const [users, tools, products, plans] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) n FROM users").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM tools WHERE published=1").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM nexauren_admin_products WHERE active=1").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM nexauren_admin_plans WHERE active=1").first()
  ]);
  return adminShell(`<main class="wrap"><div class="sectionhead"><div><span class="pill">ADMINISTRADOR</span><h1 style="margin:8px 0 0">Painel Nexauren</h1><p class="muted">Controle administrativo da plataforma.</p></div></div><div class="grid"><section class="card"><div class="muted">Usuários</div><div class="num">${Number(users?.n||0).toLocaleString()}</div></section><section class="card"><div class="muted">Ferramentas publicadas</div><div class="num">${Number(tools?.n||0).toLocaleString()}</div></section><section class="card"><div class="muted">Produtos ativos</div><div class="num">${Number(products?.n||0).toLocaleString()}</div></section><section class="card"><div class="muted">Planos ativos</div><div class="num">${Number(plans?.n||0).toLocaleString()}</div></section></div><div class="grid" style="margin-top:18px;grid-template-columns:repeat(2,1fr)"><section class="card"><h2>Produtos e créditos</h2><p class="muted">Crie os produtos de créditos e guarde os IDs do PayPal Sandbox.</p><a class="btn gold" href="/admin/products">Gerenciar produtos</a></section><section class="card"><h2>Planos</h2><p class="muted">Crie os planos Free, Pro e Premium e guarde Product ID e Plan ID.</p><a class="btn primary" href="/admin/plans">Gerenciar planos</a></section></div></main>`,`Admin`);
}

async function productsPage(req, env) {
  const rows = await env.DB.prepare("SELECT * FROM nexauren_admin_products ORDER BY created_at DESC").all();
  if (req.method === "POST") {
    const f = await req.formData();
    const id = String(f.get("id")||"").trim() || AID();
    const name = String(f.get("name")||"").trim();
    const slug = String(f.get("slug")||"").trim().toLowerCase();
    const price = Number(f.get("price")||0);
    const credits = Number(f.get("credits")||0);
    const paypalProductId = String(f.get("paypal_product_id")||"").trim();
    const paypalPriceId = String(f.get("paypal_price_id")||"").trim();
    if (!name || !slug || !Number.isFinite(price) || !Number.isInteger(credits) || credits < 0) return adminShell(`<main class="wrap"><div class="notice">Preencha nome, slug, preço e créditos corretamente.</div><a class="tab" href="/admin/products">Voltar</a></main>`,`Erro`);
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO nexauren_admin_products(id,name,slug,type,price,credits,paypal_product_id,paypal_price_id,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,price=excluded.price,credits=excluded.credits,paypal_product_id=excluded.paypal_product_id,paypal_price_id=excluded.paypal_price_id,active=1,updated_at=excluded.updated_at`).bind(id,name,slug,"credits",price,credits,paypalProductId,paypalPriceId,now,now).run();
    return ARE("/admin/products?saved=1");
  }
  const saved = new URL(req.url).searchParams.get("saved");
  return adminShell(`<main class="wrap"><div class="tabs"><a class="tab" href="/admin">Visão geral</a><a class="tab active" href="/admin/products">Produtos</a><a class="tab" href="/admin/plans">Planos</a></div><div class="sectionhead"><div><h1>Produtos de créditos</h1><p class="muted">Cadastre o produto e os IDs do PayPal.</p></div></div>${saved?`<div class="notice">Produto guardado com sucesso.</div>`:""}<section class="card"><h2>Novo produto</h2><form method="post" class="formgrid"><div class="field"><label>Nome</label><input name="name" required placeholder="Nexauren 100 Credits"></div><div class="field"><label>Slug</label><input name="slug" required placeholder="credits_100"></div><div class="field"><label>Preço (USD)</label><input name="price" type="number" step="0.01" min="0" required placeholder="1"></div><div class="field"><label>Créditos</label><input name="credits" type="number" min="0" step="1" required placeholder="100"></div><div class="field"><label>PayPal Product ID</label><input name="paypal_product_id" placeholder="PROD-..."></div><div class="field"><label>PayPal Price ID (opcional)</label><input name="paypal_price_id" placeholder="PRICE-..."></div><div class="field full"><button class="btn gold" type="submit">Criar / atualizar produto</button></div></form></section><section class="card" style="margin-top:18px"><h2>Produtos cadastrados</h2><div class="tablewrap"><table class="table"><thead><tr><th>Nome</th><th>Slug</th><th>Preço</th><th>Créditos</th><th>PayPal Product ID</th><th>Status</th></tr></thead><tbody>${rows.results.map(r=>`<tr><td>${AESC(r.name)}</td><td>${AESC(r.slug)}</td><td>$${Number(r.price).toFixed(2)}</td><td>${Number(r.credits).toLocaleString()}</td><td>${AESC(r.paypal_product_id||"—")}</td><td>${r.active?"Ativo":"Inativo"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nenhum produto cadastrado.</td></tr>`}</tbody></table></div></section></main>`,`Produtos`);
}

async function plansPage(req, env) {
  const rows = await env.DB.prepare("SELECT * FROM nexauren_admin_plans ORDER BY price ASC, created_at ASC").all();
  if (req.method === "POST") {
    const f = await req.formData();
    const id = String(f.get("id")||"").trim() || AID();
    const slug = String(f.get("slug")||"").trim().toLowerCase();
    const name = String(f.get("name")||"").trim();
    const price = Number(f.get("price")||0);
    const monthly = Number(f.get("monthly_credits")||0);
    const productId = String(f.get("paypal_product_id")||"").trim();
    const planId = String(f.get("paypal_plan_id")||"").trim();
    if (!slug || !name || !Number.isFinite(price) || !Number.isInteger(monthly) || monthly < 0) return adminShell(`<main class="wrap"><div class="notice">Preencha slug, nome, preço e créditos mensais corretamente.</div><a class="tab" href="/admin/plans">Voltar</a></main>`,`Erro`);
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO nexauren_admin_plans(id,slug,name,price,monthly_credits,paypal_product_id,paypal_plan_id,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,price=excluded.price,monthly_credits=excluded.monthly_credits,paypal_product_id=excluded.paypal_product_id,paypal_plan_id=excluded.paypal_plan_id,active=1,updated_at=excluded.updated_at`).bind(id,slug,name,price,monthly,productId,planId,now,now).run();
    await env.DB.prepare(`INSERT INTO plans(id,slug,name,price,monthly_credits,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,price=excluded.price,monthly_credits=excluded.monthly_credits,updated_at=excluded.updated_at`).bind(slug,slug,name,price,monthly,now,now).run();
    return ARE("/admin/plans?saved=1");
  }
  const saved = new URL(req.url).searchParams.get("saved");
  return adminShell(`<main class="wrap"><div class="tabs"><a class="tab" href="/admin">Visão geral</a><a class="tab" href="/admin/products">Produtos</a><a class="tab active" href="/admin/plans">Planos</a></div><div class="sectionhead"><div><h1>Planos</h1><p class="muted">Cadastre os planos e associe os IDs do PayPal Sandbox.</p></div></div>${saved?`<div class="notice">Plano guardado com sucesso.</div>`:""}<section class="card"><h2>Novo plano</h2><form method="post" class="formgrid"><div class="field"><label>Slug</label><input name="slug" required placeholder="pro"></div><div class="field"><label>Nome</label><input name="name" required placeholder="Pro"></div><div class="field"><label>Preço mensal (USD)</label><input name="price" type="number" step="0.01" min="0" required placeholder="4.99"></div><div class="field"><label>Créditos mensais</label><input name="monthly_credits" type="number" min="0" step="1" required placeholder="500"></div><div class="field"><label>PayPal Product ID</label><input name="paypal_product_id" placeholder="PROD-..."></div><div class="field"><label>PayPal Plan ID</label><input name="paypal_plan_id" placeholder="P-..."></div><div class="field full"><button class="btn primary" type="submit">Criar / atualizar plano</button></div></form></section><section class="card" style="margin-top:18px"><h2>Planos cadastrados</h2><div class="tablewrap"><table class="table"><thead><tr><th>Plano</th><th>Preço</th><th>Créditos/mês</th><th>Product ID</th><th>Plan ID</th><th>Status</th></tr></thead><tbody>${rows.results.map(r=>`<tr><td><b>${AESC(r.name)}</b><br><span class="muted">${AESC(r.slug)}</span></td><td>$${Number(r.price).toFixed(2)}</td><td>${Number(r.monthly_credits).toLocaleString()}</td><td>${AESC(r.paypal_product_id||"—")}</td><td>${AESC(r.paypal_plan_id||"—")}</td><td>${r.active?"Ativo":"Inativo"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nenhum plano cadastrado.</td></tr>`}</tbody></table></div></section></main>`,`Planos`);
}

export async function adminRouter(req, env) {
  const path = new URL(req.url).pathname;
  if (!(path === "/admin" || path === "/admin/" || path.startsWith("/admin/"))) return null;
  if (!(await isAdmin(req, env))) {
    const u = await adminUser(req, env);
    if (!u) return ARE("/login?next=/admin");
    return new Response("Acesso negado", {status:403,headers:{"Content-Type":"text/plain; charset=UTF-8"}});
  }
  if (!String(env.ADMIN_EMAIL || "").trim()) return new Response("Admin não configurado: defina o secret ADMIN_EMAIL no Worker.",{status:503});
  await ensureAdminTables(env);
  if (path === "/admin" || path === "/admin/") return dashboard(env);
  if (path === "/admin/products" || path === "/admin/products/") return productsPage(req,env);
  if (path === "/admin/plans" || path === "/admin/plans/") return plansPage(req,env);
  return new Response("Admin page not found",{status:404});
}

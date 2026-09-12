const COOKIE = "nexauren_session";
const SESSION_DAYS = 7;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function page(body, title = "Nexauren") {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Nexauren</title><style>
:root{font-family:Inter,system-ui,sans-serif;color:#f5f7fb;background:#090b10}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#182033 0,#090b10 48%)}a{color:inherit;text-decoration:none}.nav{display:flex;gap:20px;align-items:center;justify-content:space-between;padding:18px max(20px,5vw);border-bottom:1px solid #252b38;background:#0b0e15ee;position:sticky;top:0;z-index:10;backdrop-filter:blur(12px)}.brand{font-weight:900;letter-spacing:.04em}.links{display:flex;gap:14px;flex-wrap:wrap}.links a{color:#aeb7c8}.links a:hover{color:#fff}.wrap{width:min(1120px,92vw);margin:0 auto;padding:42px 0}.hero{padding:34px 0 54px}.hero h1{font-size:clamp(40px,7vw,72px);line-height:.98;margin:14px 0 20px}.muted{color:#aeb7c8}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}.card{border:1px solid #252b38;background:#11151e;padding:22px;border-radius:18px;box-shadow:0 10px 30px #0003}.card h3{margin-top:8px}.pill{display:inline-block;padding:5px 10px;border-radius:999px;background:#20283a;color:#cbd5e1;font-size:12px}.btn{display:inline-block;border:0;border-radius:10px;padding:11px 16px;background:#fff;color:#080a0e;font-weight:700;cursor:pointer}.btn.secondary{background:#20283a;color:#fff}.form{max-width:620px;margin:0 auto}.field{margin:14px 0}.field label{display:block;margin-bottom:7px;color:#cbd5e1}.field input,.field textarea,.field select{width:100%;padding:12px;border-radius:10px;border:1px solid #303747;background:#0d1118;color:#fff}.field textarea{min-height:110px;font-family:ui-monospace,monospace}.notice{padding:12px 14px;border-radius:10px;background:#151c2a;margin:14px 0}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:12px;text-align:left;border-bottom:1px solid #252b38}.actions{display:flex;gap:8px;flex-wrap:wrap}.status{font-size:12px;color:#9ee6b5}@media(max-width:700px){.links{gap:8px;font-size:14px}}
</style></head><body><nav class="nav"><a class="brand" href="/">NEXAUREN</a><div class="links"><a href="/">Home</a><a href="/tools">Ferramentas</a><a href="/register">Registro</a><a href="/login">Login</a><a href="/account">Minha conta</a><a href="/dashboard">Dashboard</a></div></nav>${body}</body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

function redirect(url, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: url, ...extraHeaders } });
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(password + salt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function userFromRequest(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return null;
  return env.DB.prepare("SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? LIMIT 1")
    .bind(match[1], Date.now()).first();
}

async function home(env) {
  const categories = await env.DB.prepare(`SELECT c.slug,c.name,c.description,c.icon,COUNT(t.slug) AS count FROM categories c LEFT JOIN tools t ON t.category=c.slug AND t.published=1 GROUP BY c.slug,c.name,c.description,c.icon ORDER BY c.name`).all();
  const featured = await env.DB.prepare("SELECT slug,name,description,category FROM tools WHERE published=1 ORDER BY created_at DESC LIMIT 12").all();
  return page(`<main class="wrap"><section class="hero"><span class="pill">Nexauren Tools</span><h1>Ferramentas úteis.<br>Organizadas. Dinâmicas.</h1><p class="muted">Cada ferramenta pode viver na sua própria pasta, com index.html, script.js e style.css, enquanto o D1 controla o catálogo e a publicação.</p><p><a class="btn" href="/tools">Explorar ferramentas</a> <a class="btn secondary" href="/register">Criar conta</a></p></section><h2>Categorias</h2><div class="grid">${categories.results.map((c) => `<a class="card" href="/tools?category=${encodeURIComponent(c.slug)}"><span class="pill">${escapeHtml(c.icon || c.slug)}</span><h3>${escapeHtml(c.name)}</h3><p class="muted">${escapeHtml(c.description || "")} · ${c.count} ferramenta(s)</p></a>`).join("")}</div><h2 style="margin-top:42px">Ferramentas recentes</h2><div class="grid">${featured.results.map((t) => `<a class="card" href="/tool/${encodeURIComponent(t.slug)}"><span class="pill">${escapeHtml(t.category)}</span><h3>${escapeHtml(t.name)}</h3><p class="muted">${escapeHtml(t.description || "")}</p></a>`).join("") || `<div class="card"><p class="muted">Nenhuma ferramenta publicada ainda.</p></div>`}</div></main>`, "Nexauren — Home");
}

async function tools(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const result = category
    ? await env.DB.prepare("SELECT slug,name,description,category FROM tools WHERE published=1 AND category=? ORDER BY name").bind(category).all()
    : await env.DB.prepare("SELECT slug,name,description,category FROM tools WHERE published=1 ORDER BY created_at DESC").all();
  return page(`<main class="wrap"><h1>Ferramentas</h1><p class="muted">${category ? `Categoria: ${escapeHtml(category)}` : "Todas as categorias"}</p><div class="grid">${result.results.map((t) => `<a class="card" href="/tool/${encodeURIComponent(t.slug)}"><span class="pill">${escapeHtml(t.category)}</span><h3>${escapeHtml(t.name)}</h3><p class="muted">${escapeHtml(t.description || "")}</p></a>`).join("") || `<div class="card"><p>Nenhuma ferramenta encontrada.</p></div>`}</div></main>`, "Ferramentas");
}

function validToolPath(value) {
  return /^tools\/(audio|image|pdf|text|productivity|business|marketplace)\/[a-z0-9-]+$/.test(value);
}

async function toolPage(slug, env, request) {
  const tool = await env.DB.prepare("SELECT slug,name,description,category,tool_path,html_file,js_file,css_file FROM tools WHERE slug=? AND published=1 LIMIT 1").bind(slug).first();
  if (!tool) return new Response("Ferramenta não encontrada", { status: 404 });
  if (!validToolPath(tool.tool_path)) return new Response("Caminho da ferramenta inválido", { status: 500 });
  if (!env.ASSETS) return new Response("Assets não configurados", { status: 500 });
  const assetUrl = new URL(`/${tool.tool_path}/${tool.html_file || "index.html"}`, request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (!assetResponse.ok) return new Response("Arquivos da ferramenta ainda não foram publicados", { status: 404 });
  return assetResponse;
}

function authForm(type) {
  const register = type === "register";
  return page(`<main class="wrap"><form class="card form" method="post"><h1>${register ? "Criar conta" : "Entrar"}</h1>${register ? `<div class="field"><label>Nome</label><input name="name" required maxlength="80"></div>` : ""}<div class="field"><label>Email</label><input type="email" name="email" required maxlength="160"></div><div class="field"><label>Senha</label><input type="password" name="password" required minlength="8"></div><button class="btn" type="submit">${register ? "Registrar" : "Entrar"}</button><p class="muted">${register ? `Já tem conta? <a href="/login">Login</a>` : `Ainda não tem conta? <a href="/register">Registro</a>`}</p></form></main>`, register ? "Registro" : "Login");
}

async function auth(request, env, type) {
  if (request.method === "GET") return authForm(type);
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!email || password.length < 8) return new Response("Email e senha válidos são obrigatórios", { status: 400 });
  if (type === "register") {
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
    const exists = await env.DB.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(email).first();
    if (exists) return new Response("Email já registrado", { status: 409 });
    const id = randomToken();
    const salt = randomToken().slice(0, 16);
    const hash = await hashPassword(password, salt);
    const role = Number(count.count) === 0 ? "admin" : "user";
    const name = String(form.get("name") || "Utilizador").trim();
    await env.DB.prepare("INSERT INTO users(id,email,name,password_hash,password_salt,role,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,email,name,hash,salt,role,Date.now()).run();
    return redirect("/login");
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (!user || await hashPassword(password, user.password_salt) !== user.password_hash) return new Response("Email ou senha inválidos", { status: 401 });
  const token = randomToken();
  await env.DB.prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)").bind(token,user.id,Date.now() + SESSION_DAYS * 86400000).run();
  return redirect("/account", { "Set-Cookie": `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` });
}

async function account(request, env) {
  const user = await userFromRequest(request, env);
  if (!user) return redirect("/login");
  return page(`<main class="wrap"><div class="card"><h1>Minha conta</h1><p><strong>${escapeHtml(user.name)}</strong></p><p class="muted">${escapeHtml(user.email)}</p><p><span class="pill">${escapeHtml(user.role)}</span></p><div class="actions"><a class="btn" href="/dashboard">Dashboard</a><form method="post" action="/logout"><button class="btn secondary">Sair</button></form></div></div></main>`, "Minha conta");
}

async function logout(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (match) await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(match[1]).run();
  return redirect("/", { "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
}

async function dashboard(request, env) {
  const user = await userFromRequest(request, env);
  if (!user || user.role !== "admin") return redirect(user ? "/account" : "/login");
  const tools = await env.DB.prepare("SELECT slug,name,category,tool_path,published FROM tools ORDER BY created_at DESC").all();
  return page(`<main class="wrap"><h1>Dashboard</h1><p class="muted">Gestão das ferramentas e do catálogo Nexauren.</p><p><a class="btn" href="/dashboard/tools/new">+ Registrar ferramenta</a></p><div class="card"><table class="table"><thead><tr><th>Nome</th><th>Categoria</th><th>Caminho</th><th>Status</th></tr></thead><tbody>${tools.results.map((t) => `<tr><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.category)}</td><td><code>${escapeHtml(t.tool_path)}</code></td><td>${t.published ? `<span class="status">Publicada</span>` : "Rascunho"}</td></tr>`).join("") || `<tr><td colspan="4">Nenhuma ferramenta registrada.</td></tr>`}</tbody></table></div></main>`, "Dashboard");
}

async function newTool(request, env) {
  const user = await userFromRequest(request, env);
  if (!user || user.role !== "admin") return redirect(user ? "/account" : "/login");
  const categories = await env.DB.prepare("SELECT slug,name FROM categories ORDER BY name").all();
  if (request.method === "GET") {
    return page(`<main class="wrap"><form class="card form" method="post"><h1>Registrar ferramenta</h1><p class="muted">A ferramenta deve existir em <code>frontend/tools/&lt;categoria&gt;/&lt;slug&gt;/</code> com index.html, script.js e style.css.</p><div class="field"><label>Nome</label><input name="name" required maxlength="120"></div><div class="field"><label>Slug</label><input name="slug" required pattern="[a-z0-9-]+" maxlength="100" placeholder="audio-converter"></div><div class="field"><label>Categoria</label><select name="category" required>${categories.results.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("")}</select></div><div class="field"><label>Descrição</label><textarea name="description" maxlength="500"></textarea></div><label><input type="checkbox" name="published"> Publicar no catálogo</label><p><button class="btn">Registrar ferramenta</button></p></form></main>`, "Registrar ferramenta");
  }
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const slug = String(form.get("slug") || "").trim().toLowerCase();
  const category = String(form.get("category") || "").trim();
  const description = String(form.get("description") || "").trim();
  if (!name || !/^[a-z0-9-]+$/.test(slug)) return new Response("Nome e slug válidos são obrigatórios", { status: 400 });
  const categoryExists = await env.DB.prepare("SELECT slug FROM categories WHERE slug=? LIMIT 1").bind(category).first();
  if (!categoryExists) return new Response("Categoria inválida", { status: 400 });
  const exists = await env.DB.prepare("SELECT slug FROM tools WHERE slug=? LIMIT 1").bind(slug).first();
  if (exists) return new Response("Slug já existe", { status: 409 });
  const toolPath = `tools/${category}/${slug}`;
  const published = form.get("published") ? 1 : 0;
  if (published && !env.ASSETS) return new Response("Assets não configurados", { status: 500 });
  await env.DB.prepare("INSERT INTO tools(slug,name,description,category,tool_path,html_file,js_file,css_file,published,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(slug,name,description,category,toolPath,"index.html","script.js","style.css",published,Date.now(),Date.now(),user.id).run();
  return redirect("/dashboard");
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (request.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
      if (path === "/") return home(env);
      if (path === "/tools") return tools(request, env);
      if (path.startsWith("/tool/")) return toolPage(decodeURIComponent(path.slice(6)), env, request);
      if (path === "/register") return auth(request, env, "register");
      if (path === "/login") return auth(request, env, "login");
      if (path === "/account") return account(request, env);
      if (path === "/logout" && request.method === "POST") return logout(request, env);
      if (path === "/dashboard") return dashboard(request, env);
      if (path === "/dashboard/tools/new") return newTool(request, env);
      return new Response("Not found", { status: 404 });
    } catch (error) {
      return new Response(`Nexauren error: ${error.message}`, { status: 500 });
    }
  }
};

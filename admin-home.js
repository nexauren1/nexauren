const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[c]));

async function isAdmin(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(/nexauren_session=([^;]+)/);
  if (!match) return false;

  const user = await env.DB.prepare(
    "SELECT u.email FROM sessions s " +
    "JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();

  const adminEmail = String(env.ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();

  return !!(
    user?.email &&
    adminEmail &&
    String(user.email).trim().toLowerCase() === adminEmail
  );
}

async function countTools(env) {
  const sources = [];

  if (env.TOOLS_DB) {
    sources.push(
      () => env.TOOLS_DB.prepare(
        "SELECT COUNT(*) AS n FROM tools " +
        "WHERE published=1"
      ).first(),
      () => env.TOOLS_DB.prepare(
        "SELECT COUNT(*) AS n FROM tools " +
        "WHERE status='published'"
      ).first(),
      () => env.TOOLS_DB.prepare(
        "SELECT COUNT(*) AS n FROM tools " +
        "WHERE active=1"
      ).first(),
      () => env.TOOLS_DB.prepare(
        "SELECT COUNT(*) AS n FROM tools"
      ).first()
    );
  }

  sources.push(
    () => env.DB.prepare(
      "SELECT COUNT(*) AS n FROM tools " +
      "WHERE published=1"
    ).first(),
    () => env.DB.prepare(
      "SELECT COUNT(*) AS n FROM tools"
    ).first()
  );

  for (const read of sources) {
    try {
      const result = await read();
      if (result && result.n !== undefined) {
        return Number(result.n) || 0;
      }
    } catch (_) {}
  }

  return 0;
}

function moduleCard({
  icon,
  title,
  text,
  href,
  tone = "blue",
  status = "active"
}) {
  const action = href
    ? `<a class="module-action" href="${href}">
        Abrir <span>→</span>
      </a>`
    : `<span class="module-action disabled">Em breve</span>`;

  const statusText = status === "active" ? "Ativo" : "Em breve";

  return `
    <article class="module ${tone}">
      <div class="module-icon">${icon}</div>
      <div class="module-copy">
        <div class="module-topline">
          <h3>${title}</h3>
          <span class="status ${status}">${statusText}</span>
        </div>
        <p>${text}</p>
        ${action}
      </div>
    </article>`;
}

export async function adminHome(req, env) {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!(await isAdmin(req, env))) {
    return new Response("Acesso administrativo não autorizado.", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8"
      }
    });
  }

  const [users, tools, posts] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM users"
    ).first().catch(() => ({ n: 0 })),
    countTools(env),
    env.BLOG_DB
      ? env.BLOG_DB.prepare(
          "SELECT COUNT(*) AS n FROM posts " +
          "WHERE status='published'"
        ).first().catch(() => ({ n: 0 }))
      : Promise.resolve({ n: 0 })
  ]);

  const userCount = Number(users?.n || 0);
  const toolCount = Number(tools || 0);
  const postCount = Number(posts?.n || 0);

  const body = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Admin Control Center | Nexauren</title>
<style>
:root{
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  color:#172033;
  background:#f6f8fc;
  --line:#e7eaf0;
  --muted:#667085;
  --blue:#2563eb;
  --blue-soft:#eff6ff;
  --violet:#7c3aed;
  --violet-soft:#f5f3ff;
  --green:#059669;
  --green-soft:#ecfdf5;
  --orange:#d97706;
  --orange-soft:#fff7ed;
  --shadow:0 18px 50px rgba(15,23,42,.07);
}
*{box-sizing:border-box}
body{margin:0;min-height:100vh}
a{text-decoration:none;color:inherit}
.app{min-height:100vh;display:grid;grid-template-columns:250px 1fr}
.sidebar{position:sticky;top:0;height:100vh;background:#fff;border-right:1px solid var(--line);padding:24px 16px;display:flex;flex-direction:column}
.logo{padding:4px 12px 25px;font-weight:950;letter-spacing:.12em;font-size:17px}
.logo small{display:block;color:#98a2b3;font-size:9px;letter-spacing:.15em;margin-top:5px}
.nav-label{font-size:10px;font-weight:900;color:#98a2b3;letter-spacing:.12em;text-transform:uppercase;padding:14px 12px 7px}
.nav a{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:11px;color:#475467;font-size:13px;font-weight:800;margin:2px 0}
.nav a:hover{background:#f5f7fa;color:#172033}
.nav a.active{background:#eff6ff;color:var(--blue)}
.nav-icon{width:22px;text-align:center;font-size:15px}
.sidebar-bottom{margin-top:auto;border-top:1px solid var(--line);padding:15px 12px 0}
.site-link{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:850;color:#475467}
.main{min-width:0;padding:28px clamp(18px,4vw,52px) 55px}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:30px}
.eyebrow{font-size:10px;font-weight:950;color:var(--blue);letter-spacing:.14em;text-transform:uppercase}
.topbar h1{font-size:clamp(28px,4vw,40px);line-height:1.08;letter-spacing:-.04em;margin:7px 0 6px}
.topbar p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}
.view-site{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:1px solid var(--line);background:#fff;border-radius:11px;font-size:12px;font-weight:850;box-shadow:0 4px 15px rgba(15,23,42,.04)}
.view-site:hover{border-color:#cbd5e1;transform:translateY(-1px)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px}
.stat{position:relative;background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 19px;box-shadow:0 5px 22px rgba(15,23,42,.035);overflow:hidden}
.stat:after{content:"";position:absolute;right:-28px;bottom:-35px;width:90px;height:90px;border-radius:50%;background:var(--blue-soft)}
.stat:nth-child(2):after{background:var(--violet-soft)}
.stat:nth-child(3):after{background:var(--green-soft)}
.stat-label{position:relative;z-index:1;color:var(--muted);font-size:12px;font-weight:800}
.stat-value{position:relative;z-index:1;font-size:31px;font-weight:950;letter-spacing:-.04em;margin-top:7px}
.section{margin-top:28px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:14px;margin-bottom:13px}
.section-head h2{font-size:17px;letter-spacing:-.02em;margin:0}.section-head p{margin:0;color:#98a2b3;font-size:11px}
.modules{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.module{display:flex;gap:15px;min-height:156px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:18px;box-shadow:0 6px 24px rgba(15,23,42,.035);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.module:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:#d6dae2}
.module-icon{width:46px;height:46px;flex:0 0 46px;display:grid;place-items:center;border-radius:13px;background:var(--blue-soft);font-size:20px;font-weight:900;color:var(--blue)}
.module.violet .module-icon{background:var(--violet-soft);color:var(--violet)}
.module.green .module-icon{background:var(--green-soft);color:var(--green)}
.module.orange .module-icon{background:var(--orange-soft);color:var(--orange)}
.module.gray .module-icon{background:#f2f4f7;color:#667085}
.module-copy{min-width:0;flex:1}.module-topline{display:flex;align-items:center;gap:9px;justify-content:space-between}
.module h3{font-size:15px;margin:0;font-weight:900}.module p{color:var(--muted);font-size:12px;line-height:1.6;margin:8px 0 14px}
.status{font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.07em;padding:4px 7px;border-radius:999px;white-space:nowrap}
.status.active{background:#ecfdf3;color:#067647}.status.soon{background:#f2f4f7;color:#667085}
.module-action{font-size:12px;font-weight:900;color:var(--blue)}.module-action span{margin-left:4px}.module-action.disabled{color:#98a2b3}
.footer{display:flex;justify-content:space-between;gap:12px;margin-top:34px;padding-top:17px;border-top:1px solid var(--line);color:#98a2b3;font-size:10px}.footer a{font-weight:800;color:#667085}
@media(max-width:900px){.app{grid-template-columns:76px 1fr}.sidebar{padding:20px 10px}.logo{padding:5px 7px 25px;font-size:13px}.logo small,.nav-label,.nav a span:not(.nav-icon),.site-link span{display:none}.nav a{justify-content:center;padding:12px}.nav-icon{width:auto}.sidebar-bottom{padding:15px 7px 0}.site-link{justify-content:center}.modules{grid-template-columns:1fr}}
@media(max-width:650px){.app{display:block}.sidebar{position:sticky;height:auto;z-index:20;border-right:0;border-bottom:1px solid var(--line);padding:10px 14px;display:block}.logo{display:inline-block;padding:7px 4px;font-size:14px}.logo small{display:block}.nav-label,.sidebar-bottom{display:none}.nav{display:flex;gap:4px;float:right}.nav a{padding:9px}.nav a.active{background:#eff6ff}.nav a span:not(.nav-icon){display:none}.main{padding:22px 15px 40px}.topbar{align-items:flex-start}.view-site{display:none}.stats{grid-template-columns:1fr;gap:10px}.stat{padding:15px}.section-head{align-items:flex-start;flex-direction:column;gap:4px}}
</style>
</head>
<body>
<div class="app">
<aside class="sidebar">
  <a class="logo" href="/admin">
    NEXAUREN
    <small>CONTROL CENTER</small>
  </a>
  <nav class="nav">
    <div class="nav-label">Principal</div>
    <a class="active" href="/admin">
      <span class="nav-icon">⌂</span><span>Visão geral</span>
    </a>
    <a href="/admin/blog/">
      <span class="nav-icon">✎</span><span>Blog</span>
    </a>
    <a href="/tools/">
      <span class="nav-icon">◫</span><span>Ferramentas</span>
    </a>
    <div class="nav-label">Negócio</div>
    <a href="/admin/products">
      <span class="nav-icon">$</span><span>Produtos</span>
    </a>
    <a href="/admin/plans">
      <span class="nav-icon">◆</span><span>Planos</span>
    </a>
    <div class="nav-label">Sistema</div>
    <a href="#users">
      <span class="nav-icon">◎</span><span>Utilizadores</span>
    </a>
    <a href="#analytics">
      <span class="nav-icon">⌁</span><span>Analytics</span>
    </a>
  </nav>
  <div class="sidebar-bottom">
    <a class="site-link" href="/">
      <span>Voltar ao site</span><b>↗</b>
    </a>
  </div>
</aside>

<main class="main">
  <header class="topbar">
    <div>
      <div class="eyebrow">Administração</div>
      <h1>Olá, Admin.</h1>
      <p>Uma visão rápida de tudo o que está a acontecer na Nexauren.</p>
    </div>
    <a class="view-site" href="/">Ver site <span>↗</span></a>
  </header>

  <section class="stats">
    <article class="stat">
      <div class="stat-label">Utilizadores</div>
      <div class="stat-value">${userCount.toLocaleString()}</div>
    </article>
    <article class="stat">
      <div class="stat-label">Ferramentas publicadas</div>
      <div class="stat-value">${toolCount.toLocaleString()}</div>
    </article>
    <article class="stat">
      <div class="stat-label">Posts publicados</div>
      <div class="stat-value">${postCount.toLocaleString()}</div>
    </article>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Conteúdo</h2>
      <p>Gerencie aquilo que os visitantes veem.</p>
    </div>
    <div class="modules">
      ${moduleCard({
        icon: "✎",
        title: "Blog",
        text: "Crie, edite, publique e agende artigos. Categorias, autores, tags e SEO ficam no mesmo espaço.",
        href: "/admin/blog/",
        tone: "blue"
      })}
      ${moduleCard({
        icon: "◫",
        title: "Ferramentas",
        text: "Veja o catálogo público de ferramentas e mantenha a estrutura da plataforma organizada.",
        href: "/tools/",
        tone: "violet"
      })}
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Produto e negócio</h2>
      <p>Monetização e planos da Nexauren.</p>
    </div>
    <div class="modules">
      ${moduleCard({
        icon: "$",
        title: "Produtos & PayPal",
        text: "Configure produtos de créditos e acompanhe a estrutura de cobrança da plataforma.",
        href: "/admin/products",
        tone: "green"
      })}
      ${moduleCard({
        icon: "◆",
        title: "Planos",
        text: "Gerencie os planos de subscrição e as respetivas configurações de cobrança.",
        href: "/admin/plans",
        tone: "orange"
      })}
    </div>
  </section>

  <section class="section" id="users">
    <div class="section-head">
      <h2>Operações</h2>
      <p>Áreas preparadas para as próximas versões.</p>
    </div>
    <div class="modules">
      ${moduleCard({
        icon: "◎",
        title: "Utilizadores",
        text: "Contas, atividade, créditos, permissões e gestão de acesso administrativo.",
        tone: "gray",
        status: "soon"
      })}
      ${moduleCard({
        icon: "⌁",
        title: "Analytics",
        text: "Métricas de tráfego, utilização das ferramentas, conteúdo e desempenho da plataforma.",
        tone: "gray",
        status: "soon"
      })}
      ${moduleCard({
        icon: "⚙",
        title: "Configurações",
        text: "Definições gerais, integrações e preferências administrativas da Nexauren.",
        tone: "gray",
        status: "soon"
      })}
      ${moduleCard({
        icon: "✓",
        title: "Logs & segurança",
        text: "Auditoria de ações administrativas, eventos do sistema e controlos de segurança.",
        tone: "gray",
        status: "soon"
      })}
    </div>
  </section>

  <footer class="footer" id="analytics">
    <span>© 2026 Nexauren · Admin Control Center</span>
    <a href="/">Nexauren.com ↗</a>
  </footer>
</main>
</div>
</body>
</html>`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

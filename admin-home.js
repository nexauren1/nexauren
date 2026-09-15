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

function card({ icon, title, text, href, tone = "blue", status = "ready" }) {
  const action = href
    ? `<a class="module-action" href="${href}">Abrir <span>→</span></a>`
    : `<span class="module-action disabled">Em breve</span>`;

  return `
    <article class="module ${tone}">
      <div class="module-icon">${icon}</div>
      <div class="module-copy">
        <div class="module-topline">
          <span class="module-title">${title}</span>
          <span class="module-status ${status}">${status === "ready" ? "Ativo" : "Em breve"}</span>
        </div>
        <p>${text}</p>
        ${action}
      </div>
    </article>`;
}

export async function adminHome(req, env) {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  if (!(await isAdmin(req, env))) {
    return new Response("Acesso administrativo não autorizado.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=UTF-8" }
    });
  }

  const [users, tools, posts] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM users").first().catch(() => ({ n: 0 })),
    env.DB.prepare("SELECT COUNT(*) AS n FROM tools WHERE published=1").first().catch(() => ({ n: 0 })),
    env.BLOG_DB
      ? env.BLOG_DB.prepare("SELECT COUNT(*) AS n FROM posts WHERE status='published'").first().catch(() => ({ n: 0 }))
      : Promise.resolve({ n: 0 })
  ]);

  const body = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Admin | Nexauren</title>
<style>
:root{
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  color:#101828;background:#f5f7fb;--line:#e4e7ec;--muted:#667085;
  --blue:#2563eb;--violet:#7c3aed;--green:#039855;--orange:#d97706;
}
*{box-sizing:border-box}body{margin:0}a{text-decoration:none;color:inherit}
.top{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
.top-inner{width:min(1240px,94vw);height:70px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{font-weight:950;letter-spacing:.1em}.brand small{display:block;font-size:10px;letter-spacing:.16em;color:var(--muted);margin-top:2px}
.nav{display:flex;gap:8px;align-items:center}.nav a{padding:9px 12px;border-radius:10px;font-size:13px;font-weight:800;color:#475467}.nav a:hover{background:#f2f4f7;color:#101828}
.wrap{width:min(1240px,94vw);margin:auto;padding:34px 0 70px}
.hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:25px}.eyebrow{font-size:12px;font-weight:900;letter-spacing:.12em;color:var(--blue);text-transform:uppercase}.hero h1{font-size:clamp(30px,5vw,44px);line-height:1.05;margin:8px 0}.hero p{margin:0;color:var(--muted);max-width:650px;line-height:1.6}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}.stat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:17px 18px}.stat-label{font-size:13px;color:var(--muted);font-weight:750}.stat-value{font-size:28px;font-weight:950;margin-top:5px}
.section-title{display:flex;align-items:center;justify-content:space-between;margin:0 0 13px}.section-title h2{font-size:18px;margin:0}.section-title span{font-size:12px;color:var(--muted)}
.modules{display:grid;grid-template-columns:repeat(2,1fr);gap:15px}.module{display:flex;gap:16px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:19px;min-height:170px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.module:hover{transform:translateY(-2px);box-shadow:0 14px 35px rgba(16,24,40,.08);border-color:#d0d5dd}.module-icon{width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:14px;font-size:22px;background:#eff6ff}.module.violet .module-icon{background:#f5f3ff}.module.green .module-icon{background:#ecfdf3}.module.orange .module-icon{background:#fff7ed}.module.gray .module-icon{background:#f2f4f7}
.module-copy{min-width:0;flex:1}.module-topline{display:flex;align-items:center;gap:9px;justify-content:space-between}.module-title{font-weight:900;font-size:17px}.module-status{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;padding:4px 7px;border-radius:999px;background:#ecfdf3;color:#067647}.module-status.soon{background:#f2f4f7;color:#667085}.module p{color:var(--muted);font-size:13px;line-height:1.55;margin:9px 0 15px;max-width:520px}.module-action{font-size:13px;font-weight:900;color:var(--blue)}.module-action span{margin-left:4px}.module-action.disabled{color:#98a2b3;cursor:default}
.footer{margin-top:30px;color:#98a2b3;font-size:12px;display:flex;justify-content:space-between;gap:15px}.footer a{color:#667085;font-weight:750}
@media(max-width:760px){.modules{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.nav a:not(.site){display:none}.hero{align-items:flex-start;flex-direction:column}}@media(max-width:480px){.stats{grid-template-columns:1fr}.wrap{padding-top:24px}.module{padding:16px}.module-status{display:none}.top-inner{height:62px}}
</style>
</head>
<body>
<header class="top"><div class="top-inner">
<a class="brand" href="/admin">NEXAUREN<small>ADMIN CONTROL CENTER</small></a>
<nav class="nav"><a href="/admin">Visão geral</a><a class="site" href="/">Ver site ↗</a></nav>
</div></header>
<main class="wrap">
<section class="hero">
<div><div class="eyebrow">Painel central</div><h1>Admin da Nexauren</h1><p>Controle o conteúdo, produto e operações da plataforma. Novas áreas podem ser adicionadas aqui sem reorganizar o sistema.</p></div>
</section>
<section class="stats">
<div class="stat"><div class="stat-label">Utilizadores</div><div class="stat-value">${Number(users?.n || 0).toLocaleString()}</div></div>
<div class="stat"><div class="stat-label">Ferramentas publicadas</div><div class="stat-value">${Number(tools?.n || 0).toLocaleString()}</div></div>
<div class="stat"><div class="stat-label">Posts publicados</div><div class="stat-value">${Number(posts?.n || 0).toLocaleString()}</div></div>
</section>
<section>
<div class="section-title"><h2>Conteúdo</h2><span>Gerencie o que aparece no site</span></div>
<div class="modules">
${card({icon:"✦",title:"Blog",text:"Crie, edite, publique e agende artigos. Gerencie categorias, autores, tags e informações de SEO.",href:"/admin/blog/",tone:"blue"})}
${card({icon:"◫",title:"Ferramentas",text:"Gerencie o catálogo de ferramentas, categorias e o estado de publicação.",href:"/admin/products",tone:"violet"})}
</div>
</section>
<section style="margin-top:28px">
<div class="section-title"><h2>Produto e negócio</h2><span>Áreas preparadas para a evolução da Nexauren</span></div>
<div class="modules">
${card({icon:"$",title:"Monetização",text:"Produtos, créditos, pagamentos e integrações de cobrança.",href:"/admin/products",tone:"green"})}
${card({icon:"◆",title:"Planos",text:"Planos Nexauren e configurações de subscrição recorrente.",href:"/admin/plans",tone:"orange"})}
${card({icon:"◎",title:"Utilizadores",text:"Contas, atividade, créditos e gestão de acesso.",tone:"gray",status:"soon"})}
${card({icon:"⌁",title:"Analytics",text:"Métricas de tráfego, utilização das ferramentas e desempenho do conteúdo.",tone:"gray",status:"soon"})}
</div>
</section>
<section style="margin-top:28px">
<div class="section-title"><h2>Sistema</h2><span>Infraestrutura e administração</span></div>
<div class="modules">
${card({icon:"⚙",title:"Configurações",text:"Configurações gerais, integrações e preferências administrativas.",tone:"gray",status:"soon"})}
${card({icon:"⌁",title:"Logs e segurança",text:"Auditoria, eventos administrativos e controles de segurança.",tone:"gray",status:"soon"})}
</div>
</section>
<footer class="footer"><span>© 2026 Nexauren · Área administrativa</span><a href="/">Voltar ao site</a></footer>
</main>
</body></html>`;

  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" }
  });
}

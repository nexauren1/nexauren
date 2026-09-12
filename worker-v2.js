const COOKIE = "nexauren_session";
const SESSION_DAYS = 7;
const CATS = [
  "audio",
  "image",
  "pdf",
  "text",
  "productivity",
  "business",
  "marketplace"
];

const esc = (v) =>
  String(v ?? "").replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));

const token = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
};

async function hash(p, s) {
  const x = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(p + s)
  );

  return [...new Uint8Array(x)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function red(url, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      ...headers
    }
  });
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

async function me(req, env) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp(`${COOKIE}=([^;]+)`));

  if (!m) return null;

  return env.DB
    .prepare(
      "SELECT u.id,u.email,u.name,u.role " +
      "FROM sessions s JOIN users u ON u.id=s.user_id " +
      "WHERE s.token=? AND s.expires_at>? LIMIT 1"
    )
    .bind(m[1], Date.now())
    .first();
}

async function ensureAccount(env, userId) {
  const existing = await env.DB
    .prepare("SELECT user_id FROM credit_balances WHERE user_id=?")
    .bind(userId)
    .first();

  if (!existing) {
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
        Date.now() + 30 * 86400000,
        Date.now()
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
    await env.DB
      .prepare(
        "INSERT INTO subscriptions(" +
        "id,user_id,plan_id,status,start_date,created_at,updated_at) " +
        "VALUES(?,?,?,?,?,?,?)"
      )
      .bind(
        token(),
        userId,
        "free",
        "active",
        Date.now(),
        Date.now(),
        Date.now()
      )
      .run();
  }
}

async function planData(env, userId) {
  await ensureAccount(env, userId);

  const sub = await env.DB
    .prepare(
      "SELECT s.*,p.name plan_name,p.slug,p.price,p.monthly_credits " +
      "FROM subscriptions s JOIN plans p ON p.id=s.plan_id " +
      "WHERE s.user_id=? AND s.status='active' " +
      "ORDER BY s.created_at DESC LIMIT 1"
    )
    .bind(userId)
    .first();

  const bal = await env.DB
    .prepare("SELECT * FROM credit_balances WHERE user_id=?")
    .bind(userId)
    .first();

  return {
    subscription: sub,
    balance: bal
  };
}

function shell(body, title, user = null) {
  const auth = user
    ? `<a href="/dashboard">Dashboard</a>
       <a href="/tools">Ferramentas</a>
       <a href="/account">Conta</a>
       <form method="post" action="/logout">
         <button>Sair</button>
       </form>`
    : `<a href="/tools">Ferramentas</a>
       <a href="/login">Entrar</a>
       <a class="primary" href="/register">Criar conta</a>`;

  return new Response(
    `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow">
  <link
    rel="canonical"
    href="https://nexaurenstory.com${new URL(
      "/",
      "https://nexaurenstory.com"
    ).pathname}"
  >
  <title>${esc(title)} | Nexauren</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system,
        "Segoe UI", sans-serif;
      color: #101828;
      background: #f8faff;
      --blue: #2563eb;
      --violet: #7c3aed;
      --line: #e5e7eb;
      --muted: #667085;
    }

    * { box-sizing: border-box; }
    body { margin: 0; }
    a { text-decoration: none; color: inherit; }

    .nav {
      height: 70px;
      background: #fff;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 max(18px, 5vw);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .brand {
      font-weight: 950;
      letter-spacing: .08em;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      background: linear-gradient(
        135deg,
        var(--blue),
        var(--violet),
        #ec4899
      );
    }

    .links {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .links a,
    .links button {
      border: 0;
      background: none;
      padding: 10px 12px;
      border-radius: 10px;
      font: inherit;
      font-weight: 750;
      color: #475467;
      cursor: pointer;
    }

    .links a:hover,
    .links button:hover {
      background: #f2f5fb;
      color: #101828;
    }

    .primary {
      background: linear-gradient(
        135deg,
        var(--blue),
        var(--violet)
      ) !important;
      color: #fff !important;
      box-shadow: 0 10px 24px #2563eb30;
    }

    .wrap {
      width: min(1120px, 92vw);
      margin: auto;
      padding: 42px 0 70px;
    }

    .hero h1 {
      font-size: clamp(38px, 6vw, 62px);
      letter-spacing: -.05em;
      margin: 12px 0;
    }

    .lead {
      color: var(--muted);
      font-size: 18px;
      line-height: 1.65;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }

    .card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 22px;
      box-shadow: 0 15px 45px #1d4ed80b;
    }

    .card h2,
    .card h3 {
      margin: 0 0 9px;
    }

    .muted { color: var(--muted); }

    .pill {
      display: inline-flex;
      padding: 7px 10px;
      border-radius: 999px;
      background: #eff6ff;
      color: var(--blue);
      font-size: 12px;
      font-weight: 850;
    }

    .credits {
      font-size: 36px;
      font-weight: 950;
      letter-spacing: -.04em;
    }

    .gold { color: #b7791f; }
    .blue { color: var(--blue); }

    .plan-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-top: 25px;
    }

    .plan { position: relative; }

    .price {
      font-size: 32px;
      font-weight: 950;
      margin: 12px 0;
    }

    .plan ul {
      padding-left: 20px;
      color: #475467;
      line-height: 1.9;
    }

    .btn {
      display: inline-flex;
      padding: 12px 16px;
      border-radius: 12px;
      background: #101828;
      color: #fff;
      font-weight: 850;
      border: 0;
      cursor: pointer;
    }

    .btn.primary {
      background: linear-gradient(
        135deg,
        var(--blue),
        var(--violet)
      );
    }

    .btn.gold {
      background: #f5b942;
      color: #3b2a00;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding: 14px 0;
      border-bottom: 1px solid #edf0f5;
    }

    .notice {
      padding: 14px 16px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 14px;
      color: #92400e;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table th,
    .table td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #edf0f5;
    }

    .tool {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tool h3 { margin: 0; }

    .footer {
      border-top: 1px solid var(--line);
      padding: 28px 0;
      color: #98a2b3;
      text-align: center;
    }

    @media (max-width: 800px) {
      .grid,
      .plan-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 600px) {
      .links a:not(.primary),
      .links form {
        display: none;
      }

      .grid,
      .plan-grid {
        grid-template-columns: 1fr;
      }

      .wrap { padding-top: 28px; }
      .nav { height: 64px; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a class="brand" href="/">
      <span class="logo"></span>
      NEXAUREN
    </a>
    <div class="links">${auth}</div>
  </nav>

  ${body}

  <footer class="footer">
    © ${new Date().getFullYear()} Nexauren
  </footer>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=UTF-8"
      }
    }
  );
}

function plansPage(user) {
  return shell(
    `<main class="wrap">
      <span class="pill">Nexauren Plans</span>
      <h1>Escolha o seu plano.</h1>
      <p class="lead">
        Os créditos do plano são azuis. Os créditos comprados
        são dourados e permanecem separados.
      </p>

      <div class="plan-grid">
        <section class="card plan">
          <span class="pill">FREE</span>
          <div class="price">$0 <small>/mês</small></div>
          <ul>
            <li>100 créditos por mês</li>
            <li>Ferramentas Free</li>
            <li>Sem pagamento</li>
          </ul>
          ${user
            ? `<button class="btn primary"
                onclick="location.href='/dashboard'">
                Usar Free
              </button>`
            : `<a class="btn primary" href="/register">
                Começar
              </a>`}
        </section>

        <section class="card plan">
          <span class="pill">PRO</span>
          <div class="price">$4,99 <small>/mês</small></div>
          <ul>
            <li>500 créditos por mês</li>
            <li>Acesso às ferramentas Pro</li>
            <li>Assinatura PayPal</li>
          </ul>
          ${user
            ? `<button class="btn primary"
                onclick="subscribe('pro')">
                Assinar Pro
              </button>`
            : `<a class="btn primary" href="/register">
                Começar
              </a>`}
        </section>

        <section class="card plan">
          <span class="pill">PREMIUM</span>
          <div class="price">$9,99 <small>/mês</small></div>
          <ul>
            <li>1.000 créditos por mês</li>
            <li>Acesso às ferramentas Premium</li>
            <li>Assinatura PayPal</li>
          </ul>
          ${user
            ? `<button class="btn primary"
                onclick="subscribe('premium')">
                Assinar Premium
              </button>`
            : `<a class="btn primary" href="/register">
                Começar
              </a>`}
        </section>
      </div>

      <h2 style="margin-top:55px">Pacotes de créditos</h2>

      <div class="grid">
        ${[[100, 1], [300, 3], [500, 5], [1000, 10]]
          .map(([c, p]) => `
            <section class="card">
              <span
                class="pill"
                style="background:#fff7df;color:#b7791f">
                CRÉDITOS PAGOS
              </span>
              <h3>${c.toLocaleString()} créditos</h3>
              <div class="price">$${p}</div>
              ${user
                ? `<button class="btn gold"
                    onclick="buyCredits('${c}')">
                    Comprar
                  </button>`
                : `<a class="btn gold" href="/register">
                    Criar conta
                  </a>`}
            </section>
          `)
          .join("")}
      </div>

      <p class="notice" style="margin-top:25px">
        PayPal Sandbox será usado para testes. Os pagamentos reais
        só devem ser ativados depois da configuração das credenciais
        de produção.
      </p>
    </main>

    <script>
      async function subscribe(plan) {
        const r = await fetch(
          "/api/paypal/subscription",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ plan })
          }
        );

        const d = await r.json();

        if (d.url) {
          location.href = d.url;
        } else {
          alert(
            d.error ||
            "PayPal Sandbox ainda não está configurado."
          );
        }
      }

      async function buyCredits(credits) {
        const r = await fetch(
          "/api/paypal/order",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ credits })
          }
        );

        const d = await r.json();

        if (d.url) {
          location.href = d.url;
        } else {
          alert(
            d.error ||
            "PayPal Sandbox ainda não está configurado."
          );
        }
      }
    </script>`,
    "Planos e Créditos",
    user
  );
}

async function dashboard(req, env) {
  const u = await me(req, env);
  if (!u) return red("/login");

  const d = await planData(env, u.id);

  const recent = await env.DB
    .prepare(
      "SELECT type,source,amount,description,created_at " +
      "FROM credit_transactions " +
      "WHERE user_id=? ORDER BY created_at DESC LIMIT 8"
    )
    .bind(u.id)
    .all();

  const s = d.subscription || {
    plan_name: "Free",
    monthly_credits: 100,
    price: 0
  };

  const b = d.balance || {
    plan_credits: 100,
    purchased_credits: 0
  };

  return shell(
    `<main class="wrap">
      <span class="pill">Dashboard</span>
      <h1>Olá, ${esc(u.name || "utilizador")}.</h1>
      <p class="lead">
        Aqui estão o seu plano, créditos e atividade da conta.
      </p>

      <div class="grid">
        <section class="card">
          <span class="pill">PLANO</span>
          <h2>${esc(s.plan_name)}</h2>
          <p class="muted">
            $${Number(s.price || 0).toFixed(2)} / mês
          </p>
          <a class="btn primary" href="/plans">
            Gerenciar plano
          </a>
        </section>

        <section class="card">
          <span class="pill">CRÉDITOS DO PLANO</span>
          <div class="credits blue">
            ${Number(b.plan_credits || 0).toLocaleString()}
          </div>
          <p class="muted">Créditos mensais · azul</p>
        </section>

        <section class="card">
          <span
            class="pill"
            style="background:#fff7df;color:#b7791f">
            CRÉDITOS COMPRADOS
          </span>
          <div class="credits gold">
            ${Number(b.purchased_credits || 0).toLocaleString()}
          </div>
          <p class="muted">Créditos pagos · dourado</p>
        </section>
      </div>

      <section class="card" style="margin-top:20px">
        <div class="row">
          <div>
            <b>Ferramentas</b>
            <div class="muted">
              Use as ferramentas disponíveis para o seu plano.
            </div>
          </div>
          <a class="btn primary" href="/tools">Explorar</a>
        </div>

        <div class="row">
          <div>
            <b>Comprar créditos</b>
            <div class="muted">
              100 · 300 · 500 · 1.000 créditos
            </div>
          </div>
          <a class="btn gold" href="/plans">Comprar</a>
        </div>
      </section>

      <section class="card" style="margin-top:20px">
        <h2>Histórico de créditos</h2>
        ${recent.results.length
          ? `<table class="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Origem</th>
                  <th>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${recent.results
                  .map(x => `
                    <tr>
                      <td>${esc(
                        new Date(
                          Number(x.created_at)
                        ).toLocaleString()
                      )}</td>
                      <td>${esc(x.type)}</td>
                      <td>${esc(x.source)}</td>
                      <td>
                        ${Number(x.amount) > 0 ? "+" : ""}
                        ${Number(x.amount)}
                      </td>
                    </tr>
                  `)
                  .join("")}
              </tbody>
            </table>`
          : `<p class="muted">
              Ainda não existem movimentos de créditos.
            </p>`}
      </section>
    </main>`,
    "Dashboard",
    u
  );
}

async function account(req, env) {
  const u = await me(req, env);
  if (!u) return red("/login");
  return dashboard(req, env);
}

async function authForm(type) {
  const reg = type === "register";

  return shell(
    `<main class="wrap">
      <section class="card" style="max-width:520px;margin:auto">
        <span class="pill">Nexauren Account</span>
        <h1>${reg ? "Criar conta" : "Entrar"}</h1>

        <form
          method="post"
          action="/${reg ? "register" : "login"}">
          ${reg
            ? `<input
                name="name"
                required
                maxlength="80"
                placeholder="Nome"
                style="width:100%;padding:13px;margin:8px 0;
                border:1px solid #dfe5ef;border-radius:12px">`
            : ""}

          <input
            type="email"
            name="email"
            required
            placeholder="Email"
            style="width:100%;padding:13px;margin:8px 0;
            border:1px solid #dfe5ef;border-radius:12px">

          <input
            type="password"
            name="password"
            required
            minlength="8"
            placeholder="Senha"
            style="width:100%;padding:13px;margin:8px 0;
            border:1px solid #dfe5ef;border-radius:12px">

          <button class="btn primary" type="submit">
            ${reg ? "Criar minha conta" : "Entrar"}
          </button>
        </form>
      </section>
    </main>`,
    reg ? "Criar conta" : "Login"
  );
}

async function tools(req, env) {
  const u = await me(req, env);
  const url = new URL(req.url);
  const cat = url.searchParams.get("category") || "";

  const sql = cat
    ? "SELECT slug,name,description,category " +
      "FROM tools WHERE published=1 AND category=? ORDER BY name"
    : "SELECT slug,name,description,category " +
      "FROM tools WHERE published=1 ORDER BY created_at DESC";

  const rows = await env.DB
    .prepare(sql)
    .bind(...(cat ? [cat] : []))
    .all();

  return shell(
    `<main class="wrap">
      <span class="pill">Nexauren Tools</span>
      <h1>Ferramentas</h1>
      <p class="lead">
        Ferramentas criadas pela Nexauren para os utilizadores.
      </p>

      <div class="grid">
        ${rows.results
          .map(t => `
            <a
              class="card tool"
              href="/tool/${encodeURIComponent(t.slug)}">
              <h3>${esc(t.name)}</h3>
              <span class="pill">${esc(t.category)}</span>
              <p class="muted">
                ${esc(t.description || "Ferramenta Nexauren")}
              </p>
            </a>
          `)
          .join("") ||
          `<section class="card">
            <h2>Nenhuma ferramenta publicada</h2>
            <p class="muted">
              As ferramentas serão adicionadas pela Nexauren.
            </p>
          </section>`}
      </div>
    </main>`,
    "Ferramentas",
    u
  );
}

function validPath(v) {
  return /^tools\/(audio|image|pdf|text|productivity|business|marketplace)\/[a-z0-9-]+$/.test(v);
}

async function toolPage(slug, env, req) {
  const t = await env.DB
    .prepare(
      "SELECT slug,name,description,category,tool_path,html_file " +
      "FROM tools WHERE slug=? AND published=1 LIMIT 1"
    )
    .bind(slug)
    .first();

  if (!t) {
    return new Response(
      "Ferramenta não encontrada",
      { status: 404 }
    );
  }

  if (!validPath(t.tool_path)) {
    return new Response(
      "Caminho inválido",
      { status: 500 }
    );
  }

  const r = await env.ASSETS.fetch(
    new Request(
      new URL(
        `/${t.tool_path}/${t.html_file || "index.html"}`,
        req.url
      ),
      req
    )
  );

  return r.ok
    ? r
    : new Response(
        "Arquivos da ferramenta ainda não publicados",
        { status: 404 }
      );
}

async function paypalToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    return null;
  }

  const base =
    env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const auth = btoa(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  );

  const r = await fetch(
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

  if (!r.ok) {
    throw new Error("PayPal OAuth failed");
  }

  return (await r.json()).access_token;
}

async function paypalOrder(req, env) {
  const u = await me(req, env);
  if (!u) {
    return json({ error: "Login necessário" }, 401);
  }

  const { credits } = await req.json();
  const map = {
    100: 1,
    300: 3,
    500: 5,
    1000: 10
  };

  const amount = map[Number(credits)];
  if (!amount) {
    return json({ error: "Pacote inválido" }, 400);
  }

  const pkg = await env.DB
    .prepare(
      "SELECT id FROM credit_packages " +
      "WHERE credits=? AND price=? AND active=1 LIMIT 1"
    )
    .bind(Number(credits), amount)
    .first();

  if (!pkg) {
    return json({ error: "Pacote não encontrado" }, 404);
  }

  const access = await paypalToken(env);
  if (!access) {
    return json(
      {
        error:
          "PayPal Sandbox não configurado. Adicione " +
          "PAYPAL_CLIENT_ID e PAYPAL_CLIENT_SECRET " +
          "nos secrets do Worker."
      },
      503
    );
  }

  const base =
    env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const origin = new URL(req.url).origin;

  const order = await fetch(
    `${base}/v2/checkout/orders`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: pkg.id,
            custom_id: `${u.id}|${pkg.id}`,
            amount: {
              currency_code: "USD",
              value: amount.toFixed(2)
            },
            description: `${credits} Nexauren Credits`
          }
        ],
        application_context: {
          brand_name: "Nexauren",
          user_action: "PAY_NOW",
          return_url: `${origin}/paypal/success`,
          cancel_url: `${origin}/plans`
        }
      })
    }
  );

  if (!order.ok) {
    return json(
      { error: "Não foi possível criar o pedido PayPal" },
      502
    );
  }

  const data = await order.json();
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
      u.id,
      pkg.id,
      Number(credits),
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
  const u = await me(req, env);
  if (!u) return red("/login");

  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  if (!orderId) return red("/plans");

  const access = await paypalToken(env);
  if (!access) return red("/plans");

  const base =
    env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const cap = await fetch(
    `${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json"
      }
    }
  );

  if (!cap.ok) {
    return new Response(
      "Pagamento não confirmado",
      { status: 400 }
    );
  }

  const purchase = await env.DB
    .prepare(
      "SELECT * FROM credit_purchases " +
      "WHERE paypal_order_id=? AND user_id=? LIMIT 1"
    )
    .bind(orderId, u.id)
    .first();

  if (!purchase) {
    return new Response(
      "Compra não encontrada",
      { status: 404 }
    );
  }

  if (purchase.status !== "completed") {
    await env.DB
      .prepare(
        "UPDATE credit_purchases " +
        "SET status='completed',completed_at=? WHERE id=?"
      )
      .bind(Date.now(), purchase.id)
      .run();

    await env.DB
      .prepare(
        "UPDATE credit_balances " +
        "SET purchased_credits=purchased_credits+?,updated_at=? " +
        "WHERE user_id=?"
      )
      .bind(purchase.credits, Date.now(), u.id)
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
        u.id,
        "purchase",
        "purchased",
        purchase.credits,
        0,
        `Compra de ${purchase.credits} créditos`,
        orderId,
        Date.now()
      )
      .run();
  }

  return red("/dashboard?payment=success");
}

async function getAdminPayPalPlan(env, slug) {
  return await env.DB
    .prepare(`
      SELECT paypal_plan_id
      FROM nexauren_admin_plans
      WHERE slug = ?
        AND active = 1
      LIMIT 1
    `)
    .bind(slug)
    .first();
}

async function paypalSubscription(req, env) {
  const u = await me(req, env);
  if (!u) {
    return json({ error: "Login necessário" }, 401);
  }

  const { plan } = await req.json();

  const allowed = ["pro", "premium"];

  if (!allowed.includes(plan)) {
    return json({
      error: "Plano inválido"
    }, 400);
  }

  const adminPlan = await getAdminPayPalPlan(
    env,
    plan
  );

  const planId = adminPlan?.paypal_plan_id;

  if (!planId) {
    return json({
      error: "Plano PayPal não configurado"
    }, 400);
  }

  const access = await paypalToken(env);
  if (!access) {
    return json(
      { error: "PayPal Sandbox não configurado." },
      503
    );
  }

  const base =
    env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

  const origin = new URL(req.url).origin;

  const r = await fetch(
    `${base}/v1/billing/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: u.id,
        application_context: {
          brand_name: "Nexauren",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${origin}/dashboard`,
          cancel_url: `${origin}/plans`
        }
      })
    }
  );

  if (!r.ok) {
    return json(
      {
        error:
          "Não foi possível criar a assinatura PayPal."
      },
      502
    );
  }

  const d = await r.json();
  const url = d.links?.find(
    x => x.rel === "approve"
  )?.href;

  return json({
    url,
    subscription_id: d.id
  });
}

import { adminRouter } from "./admin.js";

export default {
  async fetch(req, env) {
    const __adminResponse = await adminRouter(req, env);
    if (__adminResponse) return __adminResponse;

    const url = new URL(req.url);
    const p = url.pathname;
    const u = await me(req, env);

    try {
      if ((p === "/register" || p === "/login") && u) {
        return red("/dashboard");
      }

      if (p === "/") {
        return shell(
          `<main class="wrap">
            <span class="pill">Nexauren Platform</span>
            <section class="hero">
              <h1>
                Ferramentas digitais
                <span style="color:#2563eb">
                  feitas para simplificar.
                </span>
              </h1>
              <p class="lead">
                Use ferramentas criadas pela Nexauren. Escolha um plano,
                receba créditos e use recursos avançados quando precisar.
              </p>
              <p>
                <a class="btn primary" href="/tools">
                  Explorar ferramentas
                </a>
                <a class="btn" href="/plans">
                  Ver planos
                </a>
              </p>
            </section>
          </main>`,
          "Nexauren",
          u
        );
      }

      if (p === "/plans") {
        return plansPage(u);
      }

      if (p === "/dashboard" || p === "/account") {
        return dashboard(req, env);
      }

      if (p === "/tools") {
        return tools(req, env);
      }

      if (p.startsWith("/tool/")) {
        return toolPage(
          decodeURIComponent(p.slice(6)),
          env,
          req
        );
      }

      if (p === "/paypal/success") {
        return paypalCapture(req, env);
      }

      if (
        p === "/api/paypal/order" &&
        req.method === "POST"
      ) {
        return paypalOrder(req, env);
      }

      if (
        p === "/api/paypal/subscription" &&
        req.method === "POST"
      ) {
        return paypalSubscription(req, env);
      }

      if (
        p === "/register" &&
        req.method === "GET"
      ) {
        return authForm("register");
      }

      if (
        p === "/login" &&
        req.method === "GET"
      ) {
        return authForm("login");
      }

      if (
        p === "/logout" &&
        req.method === "POST"
      ) {
        const c = req.headers.get("Cookie") || "";
        const m = c.match(
          new RegExp(`${COOKIE}=([^;]+)`)
        );

        if (m) {
          await env.DB
            .prepare("DELETE FROM sessions WHERE token=?")
            .bind(m[1])
            .run();
        }

        return red(
          "/",
          {
            "Set-Cookie":
              `${COOKIE}=; Max-Age=0; HttpOnly; ` +
              "Secure; SameSite=Lax; Path=/"
          }
        );
      }

      if (
        (p === "/register" || p === "/login") &&
        req.method === "POST"
      ) {
        const f = await req.formData();
        const email = String(
          f.get("email") || ""
        ).trim().toLowerCase();
        const password = String(
          f.get("password") || ""
        );
        const name = String(
          f.get("name") || ""
        ).trim();

        if (
          !email ||
          password.length < 8 ||
          (p === "/register" && !name)
        ) {
          return new Response(
            "Dados inválidos",
            { status: 400 }
          );
        }

        if (p === "/register") {
          const ex = await env.DB
            .prepare(
              "SELECT id FROM users WHERE email=? LIMIT 1"
            )
            .bind(email)
            .first();

          if (ex) {
            return new Response(
              "Email já registado",
              { status: 409 }
            );
          }

          const id = token();
          const salt = token();
          const ph = await hash(password, salt);
          const cnt = await env.DB
            .prepare("SELECT COUNT(*) count FROM users")
            .first();
          const role =
            Number(cnt?.count || 0) === 0
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
              ph,
              salt,
              role,
              "active",
              Date.now(),
              Date.now()
            )
            .run();

          await ensureAccount(env, id);

          const s = token();

          await env.DB
            .prepare(
              "INSERT INTO sessions(token,user_id,expires_at) " +
              "VALUES(?,?,?)"
            )
            .bind(
              s,
              id,
              Date.now() + SESSION_DAYS * 86400000
            )
            .run();

          return red(
            "/dashboard",
            {
              "Set-Cookie":
                `${COOKIE}=${s}; ` +
                `Max-Age=${SESSION_DAYS * 86400}; ` +
                "HttpOnly; Secure; SameSite=Lax; Path=/"
            }
          );
        }

        const found = await env.DB
          .prepare(
            "SELECT id,password_hash,password_salt " +
            "FROM users WHERE email=? LIMIT 1"
          )
          .bind(email)
          .first();

        if (
          !found ||
          await hash(password, found.password_salt) !==
            found.password_hash
        ) {
          return new Response(
            "Email ou senha incorretos",
            { status: 401 }
          );
        }

        await ensureAccount(env, found.id);

        const s = token();

        await env.DB
          .prepare(
            "INSERT INTO sessions(token,user_id,expires_at) " +
            "VALUES(?,?,?)"
          )
          .bind(
            s,
            found.id,
            Date.now() + SESSION_DAYS * 86400000
          )
          .run();

        return red(
          "/dashboard",
          {
            "Set-Cookie":
              `${COOKIE}=${s}; ` +
              `Max-Age=${SESSION_DAYS * 86400}; ` +
              "HttpOnly; Secure; SameSite=Lax; Path=/"
          }
        );
      }

      return env.ASSETS.fetch(req);
    } catch (e) {
      return json(
        {
          error: "Erro interno",
          detail: String(e?.message || e)
        },
        500
      );
    }
  }
};
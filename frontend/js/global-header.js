(() => {
  const ID = "nx-global-header";
  if (document.getElementById(ID)) return;

  const style = document.createElement("style");
  style.textContent = `
    #${ID}{
      position:relative;
      z-index:1000;
      background:#fff;
      border-bottom:1px solid #e7eaf0;
      box-shadow:0 4px 18px rgba(16,24,40,.04)
    }
    #${ID} .nx-head-inner{
      width:min(1180px,92vw);
      min-height:70px;
      margin:auto;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:24px
    }
    #${ID} .nx-brand{
      color:#111827;
      text-decoration:none;
      font-weight:950;
      letter-spacing:.08em;
      white-space:nowrap
    }
    #${ID} .nx-brand span{color:#7c3aed}
    #${ID} .nx-links{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:22px
    }
    #${ID} .nx-links a{
      color:#475467;
      text-decoration:none;
      font-weight:750;
      font-size:14px
    }
    #${ID} .nx-links a:hover{color:#2563eb}
    #${ID} .nx-btn{
      padding:10px 15px;
      border-radius:11px;
      background:#2563eb;
      color:#fff!important
    }
    #${ID} .nx-btn:hover{background:#1d4ed8}
    #${ID} .nx-menu{
      display:none;
      border:0;
      background:#f3f5f9;
      color:#344054;
      width:42px;
      height:42px;
      border-radius:11px;
      font-size:21px;
      cursor:pointer
    }
    #${ID} .nx-mobile{
      display:none;
      border-top:1px solid #edf0f5;
      padding:12px 4vw 18px;
      background:#fff
    }
    #${ID} .nx-mobile.open{display:grid;gap:4px}
    #${ID} .nx-mobile a{
      color:#344054;
      text-decoration:none;
      padding:12px;
      border-radius:10px;
      font-weight:750
    }
    #${ID} .nx-mobile a:hover{background:#f5f7fb}
    @media(max-width:800px){
      #${ID} .nx-links{display:none}
      #${ID} .nx-menu{display:block}
      #${ID} .nx-head-inner{min-height:62px}
    }
  `;
  document.head.appendChild(style);

  const old = document.querySelector("header, nav.nav, nav");
  const host = document.createElement("div");
  host.id = ID;

  const render = user => {
    const accountLinks = user
      ? `
        <a href="/dashboard/">Dashboard</a>
        <a href="/account/">Minha conta</a>
        <a href="/api/auth/logout" data-nx-logout>Sair</a>
      `
      : `
        <a href="/login/">Entrar</a>
        <a class="nx-btn" href="/register/">Criar conta</a>
      `;

    host.innerHTML = `
      <div class="nx-head-inner">
        <a class="nx-brand" href="/">NEXA<span>UREN</span></a>
        <nav class="nx-links" aria-label="Navegação principal">
          <a href="/tools/">Ferramentas</a>
          <a href="/plans/">Planos</a>
          <a href="/about/">Sobre</a>
          ${accountLinks}
        </nav>
        <button class="nx-menu" type="button" aria-label="Abrir menu" aria-expanded="false">☰</button>
      </div>
      <nav class="nx-mobile" aria-label="Menu móvel"></nav>
    `;

    const mobile = host.querySelector(".nx-mobile");
    mobile.innerHTML = `
      <a href="/">Início</a>
      <a href="/tools/">Ferramentas</a>
      <a href="/plans/">Planos</a>
      <a href="/about/">Sobre o Nexauren</a>
      ${accountLinks}
    `;

    const menu = host.querySelector(".nx-menu");
    menu.addEventListener("click", () => {
      const open = mobile.classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
      menu.textContent = open ? "×" : "☰";
      document.body.style.overflow = open ? "hidden" : "";
    });

    mobile.addEventListener("click", event => {
      if (event.target.closest("a")) {
        mobile.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.textContent = "☰";
        document.body.style.overflow = "";
      }
    });

    host.querySelectorAll("[data-nx-logout]").forEach(link => {
      link.addEventListener("click", async event => {
        event.preventDefault();
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin"
          });
        } finally {
          location.href = "/";
        }
      });
    });
  };

  render(null);
  if (old) old.replaceWith(host);
  else document.body.prepend(host);

  fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store"
  })
    .then(response => response.ok ? response.json() : null)
    .then(data => render(data?.user || null))
    .catch(() => render(null));
})();

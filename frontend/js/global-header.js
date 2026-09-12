(() => {
  const ID = "nx-global-header";
  if (document.getElementById(ID)) return;

  const style = document.createElement("style");
  style.textContent = `
    #${ID}{position:relative;z-index:1000;background:rgba(255,255,255,.76);border-bottom:1px solid rgba(223,231,245,.9);box-shadow:0 8px 30px rgba(50,70,120,.05);backdrop-filter:blur(20px)}
    #${ID} .nx-head-inner{width:min(1180px,92vw);min-height:70px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:24px}
    #${ID} .nx-brand{color:#14213d;text-decoration:none;font-weight:950;letter-spacing:.11em;white-space:nowrap}
    #${ID} .nx-brand span{color:#7c3aed}
    #${ID} .nx-links{display:flex;align-items:center;justify-content:flex-end;gap:7px}
    #${ID} .nx-links a{color:#506078;text-decoration:none;font-weight:750;font-size:14px;padding:10px 12px;border-radius:11px;transition:.2s ease}
    #${ID} .nx-links a:hover{color:#3157e8;background:#f0f4ff}
    #${ID} .nx-btn{padding:10px 15px!important;background:linear-gradient(135deg,#3157e8,#7c3aed)!important;color:#fff!important;box-shadow:0 10px 26px rgba(73,76,220,.20)}
    #${ID} .nx-btn:hover{color:#fff!important;transform:translateY(-1px)}
    #${ID} .nx-menu{display:none;border:1px solid #dfe7f5;background:rgba(255,255,255,.9);color:#3157e8;width:42px;height:42px;border-radius:12px;font-size:21px;cursor:pointer;box-shadow:0 8px 22px rgba(46,66,120,.08)}
    #${ID} .nx-mobile{display:none;border-top:1px solid #e8edf6;padding:12px 4vw 18px;background:rgba(255,255,255,.96);backdrop-filter:blur(18px)}
    #${ID} .nx-mobile.open{display:grid;gap:4px}
    #${ID} .nx-mobile a{color:#344054;text-decoration:none;padding:12px;border-radius:11px;font-weight:750}
    #${ID} .nx-mobile a:hover{background:#f0f4ff;color:#3157e8}
    @media(max-width:800px){#${ID} .nx-links{display:none}#${ID} .nx-menu{display:block}#${ID} .nx-head-inner{min-height:64px}}
  `;
  document.head.appendChild(style);

  const old = document.querySelector("header, nav.nav, nav");
  const host = document.createElement("div");
  host.id = ID;

  const render = user => {
    const accountLinks = user
      ? `<a href="/dashboard/">Dashboard</a><a href="/account/">My account</a><a href="/api/auth/logout" data-nx-logout>Sign out</a>`
      : `<a href="/login/">Sign in</a><a class="nx-btn" href="/register/">Create account</a>`;

    host.innerHTML = `
      <div class="nx-head-inner">
        <a class="nx-brand" href="/">NEXA<span>UREN</span></a>
        <nav class="nx-links" aria-label="Main navigation">
          <a href="/tools/">Tools</a><a href="/plans/">Plans</a><a href="/about/">About</a>${accountLinks}
        </nav>
        <button class="nx-menu" type="button" aria-label="Open menu" aria-expanded="false">☰</button>
      </div>
      <nav class="nx-mobile" aria-label="Mobile menu"></nav>`;

    const mobile = host.querySelector(".nx-mobile");
    mobile.innerHTML = `<a href="/">Home</a><a href="/tools/">Tools</a><a href="/plans/">Plans</a><a href="/about/">About Nexauren</a>${accountLinks}`;

    const menu = host.querySelector(".nx-menu");
    menu.addEventListener("click", () => {
      const open = mobile.classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.textContent = open ? "×" : "☰";
      document.body.style.overflow = open ? "hidden" : "";
    });

    mobile.addEventListener("click", event => {
      if (!event.target.closest("a")) return;
      mobile.classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Open menu");
      menu.textContent = "☰";
      document.body.style.overflow = "";
    });

    host.querySelectorAll("[data-nx-logout]").forEach(link => {
      link.addEventListener("click", async event => {
        event.preventDefault();
        try { await fetch("/api/auth/logout", {method:"POST", credentials:"same-origin"}); }
        finally { location.href = "/"; }
      });
    });
  };

  render(null);
  if (old) old.replaceWith(host); else document.body.prepend(host);

  fetch("/api/auth/me", {credentials:"same-origin",cache:"no-store"})
    .then(response => response.ok ? response.json() : null)
    .then(data => render(data?.user || null))
    .catch(() => render(null));
})();

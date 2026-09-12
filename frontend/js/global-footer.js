(() => {
  const oldFooter = document.querySelector("footer");
  const footer = document.createElement("footer");
  footer.className = "nx-footer";

  const style = document.createElement("style");
  style.textContent = `
    .nx-footer{margin-top:70px;background:#fff;border-top:1px solid #e7ebf3;color:#667085;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    .nx-footer-inner{width:min(1180px,92vw);margin:auto;padding:54px 0 42px;display:grid;grid-template-columns:2fr repeat(3,1fr);gap:42px}
    .nx-footer-brand{max-width:330px}
    .nx-footer-logo{display:inline-block;color:#101828;text-decoration:none;font-size:21px;font-weight:950;letter-spacing:-.04em}
    .nx-footer-logo span{color:#6d4aff}
    .nx-footer-brand p{margin:13px 0 0;line-height:1.7;font-size:14px;color:#7b8798}
    .nx-footer-column{display:flex;flex-direction:column;align-items:flex-start;gap:11px}
    .nx-footer-column h3{margin:0 0 5px;color:#101828;font-size:13px;font-weight:850}
    .nx-footer-column a{color:#667085;text-decoration:none;font-size:14px;line-height:1.4;transition:color .18s ease,transform .18s ease}
    .nx-footer-column a:hover{color:#3157e8;transform:translateX(2px)}
    .nx-footer-bottom{width:min(1180px,92vw);margin:auto;padding:19px 0 24px;border-top:1px solid #edf0f5;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;font-size:12px;color:#98a2b3}
    @media(max-width:760px){.nx-footer{margin-top:50px}.nx-footer-inner{grid-template-columns:1fr 1fr;gap:30px 22px;padding:42px 0 32px}.nx-footer-brand{grid-column:1/-1;max-width:none}.nx-footer-bottom{padding-bottom:22px;line-height:1.6}}
    @media(max-width:430px){.nx-footer-inner{grid-template-columns:1fr}.nx-footer-brand{grid-column:auto}}
    @media(prefers-reduced-motion:reduce){.nx-footer-column a{transition:none}}
  `;
  document.head.appendChild(style);

  const render = user => {
    const account = user
      ? `
        <a href="/dashboard/">Dashboard</a>
        <a href="/account/">Minha conta</a>
        <a href="#" data-nx-footer-logout>Sair</a>
      `
      : `
        <a href="/login/">Entrar</a>
        <a href="/register/">Criar conta</a>
      `;

    footer.innerHTML = `
      <div class="nx-footer-inner">
        <div class="nx-footer-brand">
          <a href="/" class="nx-footer-logo">NEXA<span>UREN</span></a>
          <p>Ferramentas digitais simples, rápidas e úteis para o dia a dia.</p>
        </div>
        <div class="nx-footer-column">
          <h3>Explorar</h3>
          <a href="/tools/">Ferramentas</a>
          <a href="/plans/">Planos</a>
          <a href="/about/">Sobre o Nexauren</a>
        </div>
        <div class="nx-footer-column">
          <h3>Conta</h3>
          ${account}
        </div>
        <div class="nx-footer-column">
          <h3>Informações</h3>
          <a href="/privacy/">Privacidade</a>
          <a href="/terms/">Termos de uso</a>
          <a href="/cookies/">Cookies</a>
        </div>
      </div>
      <div class="nx-footer-bottom">
        <span>© 2026 Nexauren. Todos os direitos reservados.</span>
        <span>Feito para tornar tarefas digitais mais simples.</span>
      </div>
    `;

    const logout = footer.querySelector("[data-nx-footer-logout]");
    if (logout) {
      logout.addEventListener("click", async event => {
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
    }
  };

  render(null);
  if (oldFooter) oldFooter.replaceWith(footer);
  else document.body.appendChild(footer);

  fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store"
  })
    .then(response => response.ok ? response.json() : null)
    .then(data => render(data?.user || null))
    .catch(() => render(null));
})();

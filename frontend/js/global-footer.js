(() => {
  const oldFooter = document.querySelector("footer");
  const footer = document.createElement("footer");
  footer.className = "nx-footer";
  const style = document.createElement("style");
  style.textContent = `.nx-footer{margin-top:70px;background:rgba(255,255,255,.60);border-top:1px solid #dfe7f5;color:#66758d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;backdrop-filter:blur(18px)}.nx-footer-inner{width:min(1180px,92vw);margin:auto;padding:54px 0 42px;display:grid;grid-template-columns:2fr repeat(3,1fr);gap:42px}.nx-footer-brand{max-width:330px}.nx-footer-logo{display:inline-block;color:#14213d;text-decoration:none;font-size:21px;font-weight:950;letter-spacing:.02em}.nx-footer-logo span{color:#7c3aed}.nx-footer-brand p{margin:13px 0 0;line-height:1.7;font-size:14px;color:#7b8798}.nx-footer-column{display:flex;flex-direction:column;align-items:flex-start;gap:11px}.nx-footer-column h3{margin:0 0 5px;color:#263654;font-size:13px;font-weight:850}.nx-footer-column a{color:#667085;text-decoration:none;font-size:14px;line-height:1.4;transition:color .18s ease,transform .18s ease}.nx-footer-column a:hover{color:#3157e8;transform:translateX(2px)}.nx-footer-bottom{width:min(1180px,92vw);margin:auto;padding:19px 0 24px;border-top:1px solid #e8edf6;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;font-size:12px;color:#98a2b3}@media(max-width:760px){.nx-footer{margin-top:50px}.nx-footer-inner{grid-template-columns:1fr 1fr;gap:30px 22px;padding:42px 0 32px}.nx-footer-brand{grid-column:1/-1;max-width:none}}@media(max-width:430px){.nx-footer-inner{grid-template-columns:1fr}.nx-footer-brand{grid-column:auto}}`;
  document.head.appendChild(style);
  const render = user => {
    const account = user ? `<a href="/dashboard/">Dashboard</a><a href="/account/">My account</a><a href="#" data-nx-footer-logout>Sign out</a>` : `<a href="/login/">Sign in</a><a href="/register/">Create account</a>`;
    footer.innerHTML = `<div class="nx-footer-inner"><div class="nx-footer-brand"><a href="/" class="nx-footer-logo">NEXA<span>UREN</span></a><p>Simple, fast and useful digital tools for turning everyday tasks into better experiences.</p></div><div class="nx-footer-column"><h3>Explore</h3><a href="/tools/">Tools</a><a href="/plans/">Plans</a><a href="/about/">About Nexauren</a></div><div class="nx-footer-column"><h3>Account</h3>${account}</div><div class="nx-footer-column"><h3>Information</h3><a href="/privacy/">Privacy</a><a href="/terms/">Terms of use</a><a href="/cookies/">Cookies</a></div></div><div class="nx-footer-bottom"><span>© 2026 Nexauren. All rights reserved.</span><span>Built to make digital tasks simpler.</span></div>`;
    const logout = footer.querySelector("[data-nx-footer-logout]");
    if (logout) logout.addEventListener("click", async event => {event.preventDefault();try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});}finally{location.href="/";}});
  };
  render(null);
  if (oldFooter) oldFooter.replaceWith(footer); else document.body.appendChild(footer);
  fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>render(d?.user||null)).catch(()=>render(null));
})();

(() => {
  const ID = "nx-global-loader";
  if (document.getElementById(ID)) return;

  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/png";
  icon.href = "/favicon.png";
  document.head.appendChild(icon);

  const touch = document.createElement("link");
  touch.rel = "apple-touch-icon";
  touch.href = "/favicon.png";
  document.head.appendChild(touch);

  const theme = document.createElement("link");
  theme.rel = "stylesheet";
  theme.href = "/css/nexauren-theme.css";
  document.head.appendChild(theme);

  const pages = document.createElement("link");
  pages.rel = "stylesheet";
  pages.href = "/css/nexauren-pages.css";
  document.head.appendChild(pages);

  const style = document.createElement("style");
  style.textContent = `#${ID}{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(247,250,255,.78);backdrop-filter:blur(10px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility .18s ease}#${ID}.show{opacity:1;visibility:visible;pointer-events:all}#${ID} .nx-loader-box{text-align:center}#${ID} .nx-spinner{width:46px;height:46px;margin:auto;border-radius:50%;border:4px solid #e8edf5;border-top-color:#3157e8;border-right-color:#7c3aed;animation:nxGlobalSpin .72s linear infinite;box-shadow:0 10px 30px rgba(49,87,232,.16)}#${ID} .nx-loader-text{margin-top:12px;color:#667085;font:750 13px/1.4 Inter,system-ui,sans-serif}@keyframes nxGlobalSpin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(style);

  const loader = document.createElement("div");
  loader.id = ID;
  loader.setAttribute("aria-hidden", "true");
  loader.innerHTML = '<div class="nx-loader-box"><div class="nx-spinner" aria-hidden="true"></div><div class="nx-loader-text">Loading…</div></div>';
  document.body.appendChild(loader);

  const text = loader.querySelector(".nx-loader-text");
  const defaultText = "Loading…";
  const headerScript = document.createElement("script");
  headerScript.src = "/js/global-header.js";
  headerScript.defer = true;
  document.head.appendChild(headerScript);

  const footerScript = document.createElement("script");
  footerScript.src = "/js/global-footer.js";
  footerScript.defer = true;
  document.head.appendChild(footerScript);

  let timer = null;
  let firstLoad = true;

  const setText = (message = defaultText) => {
    text.textContent = message;
  };

  const show = (message = defaultText) => {
    clearTimeout(timer);
    setText(message);
    loader.classList.add("show");
  };

  const hide = (delay = 120) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      loader.classList.remove("show");
      setText(defaultText);
    }, delay);
  };

  window.NexaurenLoader = {
    show,
    hide,
    showProcessing: (message = "Processing…") => show(message),
    hideProcessing: hide,
    setText
  };

  show();

  const finishInitialLoad = () => {
    if (!firstLoad) return;
    firstLoad = false;
    hide(180);
  };

  if (document.readyState === "complete") {
    finishInitialLoad();
  } else {
    window.addEventListener("load", finishInitialLoad, { once: true });
  }

  setTimeout(finishInitialLoad, 1400);

  document.addEventListener("click", event => {
    const link = event.target.closest?.("a[href]");
    if (!link || event.defaultPrevented) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;

    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin || url.href === location.href) return;
      show();
    } catch (_) {}
  }, true);

  document.addEventListener("submit", event => {
    if (event.defaultPrevented) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.target && form.target !== "_self") return;
    show();
  }, true);

  window.addEventListener("pageshow", () => hide(120));
  window.addEventListener("pagehide", () => hide(120));
})();

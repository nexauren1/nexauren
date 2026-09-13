(() => {
  "use strict";

  const APP = "NexaurenApp";
  const FAVICON = "/favicon.png";

  if (window[APP]) return;

  const state = {
    ready: false,
    page: location.pathname
  };

  function ensureMeta() {
    if (!document.head) return;

    let icon = document.querySelector('link[rel="icon"][href="/favicon.png"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/png";
      icon.href = FAVICON;
      document.head.appendChild(icon);
    }

    let touch = document.querySelector(
      'link[rel="apple-touch-icon"][href="/favicon.png"]'
    );
    if (!touch) {
      touch = document.createElement("link");
      touch.rel = "apple-touch-icon";
      touch.href = FAVICON;
      document.head.appendChild(touch);
    }
  }

  function initMobileMenu() {
    const button = document.getElementById("menuBtn");
    const menu = document.getElementById("mobileMenu");
    if (!button || !menu) return;

    const close = () => {
      menu.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    };

    button.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", close);
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !button.contains(event.target)) {
        close();
      }
    });
  }

  function initFinder() {
    const input = document.querySelector(".searchbox input");
    const results = document.querySelector(".tool-results");
    if (!input || !results) return;

    const items = Array.from(results.querySelectorAll(".finder-tool"));

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      let visible = 0;

      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        const match = !query || text.includes(query);
        item.hidden = !match;
        if (match) visible += 1;
      });

      let empty = results.querySelector(".finder-empty");

      if (!visible && query) {
        if (!empty) {
          empty = document.createElement("div");
          empty.className = "finder-empty";
          results.appendChild(empty);
        }
        empty.textContent = "No tools found. Try another search.";
      } else if (empty) {
        empty.remove();
      }
    });
  }

  function initInternalLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      if (event.defaultPrevented) return;

      const raw = link.getAttribute("href");
      if (!raw || raw.startsWith("#")) return;

      try {
        const url = new URL(raw, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.search === location.search) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent("nexauren:navigate", {
            detail: { url: url.href }
          })
        );
      } catch (_) {
        // Ignore malformed links.
      }
    });
  }

  function init() {
    if (state.ready) return;

    ensureMeta();
    initMobileMenu();
    initFinder();
    initInternalLinks();

    state.ready = true;
    window.dispatchEvent(
      new CustomEvent("nexauren:ready", {
        detail: { page: state.page }
      })
    );
  }

  window[APP] = {
    version: "1.0.0",
    state,
    init,
    ensureMeta
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

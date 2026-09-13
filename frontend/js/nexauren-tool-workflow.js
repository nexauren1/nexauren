(() => {
  "use strict";

  // Nexauren Tool Workflow
  // Frontend-only automation for every individual tool page.
  // Worker, D1, auth, PayPal and credit routes remain untouched.

  const path = window.location.pathname.replace(/\/+$/, "");
  const isToolPage = path.startsWith("/tools/") && path !== "/tools";

  if (!isToolPage || window.__nexaurenToolWorkflow) {
    return;
  }

  window.__nexaurenToolWorkflow = true;

  const loadScriptOnce = (src, id) => {
    if (id && document.getElementById(id)) {
      return;
    }

    const script = document.createElement("script");
    if (id) {
      script.id = id;
    }
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  };

  // Every individual tool gets the standard ad workflow.
  // Visitors and Free users receive ads; Pro and Premium are filtered
  // by nexauren-ads.js using the existing account/plan endpoint.
  loadScriptOnce("/js/nexauren-ads.js", "nexauren-ads-loader");
})();

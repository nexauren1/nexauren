(() => {
  const GA_ID = "G-Y4K8V974Q1";
  const CONSENT_KEY = "nx-consent-v1";
  const BANNER_ID = "nx-consent-banner";

  const readConsent = () => {
    try {
      const value = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  };

  const loadGoogleAnalytics = () => {
    if (window.__nexaurenGA || !GA_ID) return;
    window.__nexaurenGA = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      send_page_view: true
    });

    window.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    });
  };

  const saveConsent = (analytics, ads) => {
    const value = {
      analytics: Boolean(analytics),
      ads: Boolean(ads),
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
    } catch (_) {}

    if (value.analytics) loadGoogleAnalytics();
    window.dispatchEvent(new CustomEvent("nexauren:consent", { detail: value }));
  };

  const showBanner = () => {
    if (document.getElementById(BANNER_ID)) return;

    const style = document.createElement("style");
    style.textContent = `
      #${BANNER_ID}{position:fixed;left:18px;right:18px;bottom:18px;z-index:99990;display:flex;align-items:center;justify-content:space-between;gap:22px;padding:18px 20px;border:1px solid #dfe7f5;border-radius:18px;background:rgba(255,255,255,.97);box-shadow:0 20px 60px rgba(20,33,61,.18);font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#14213d}
      #${BANNER_ID} .nx-consent-copy{max-width:720px}
      #${BANNER_ID} strong{display:block;font-size:14px;margin-bottom:5px}
      #${BANNER_ID} p{margin:0;color:#667085;font-size:12px;line-height:1.55}
      #${BANNER_ID} a{color:#3157e8;text-decoration:none;font-weight:750}
      #${BANNER_ID} .nx-consent-actions{display:flex;gap:8px;flex:0 0 auto}
      #${BANNER_ID} button{border:1px solid #d8e0ec;border-radius:11px;padding:10px 13px;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}
      #${BANNER_ID} .nx-essential{background:#fff;color:#475467}
      #${BANNER_ID} .nx-accept{border-color:#3157e8;background:linear-gradient(135deg,#3157e8,#7c3aed);color:#fff}
      @media(max-width:680px){#${BANNER_ID}{left:10px;right:10px;bottom:10px;display:block;padding:16px}.nx-consent-actions{margin-top:12px;display:grid!important;grid-template-columns:1fr 1fr}.nx-consent-actions button{width:100%}}
    `;
    document.head.appendChild(style);

    const banner = document.createElement("aside");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Privacy choices");
    banner.innerHTML = `
      <div class="nx-consent-copy">
        <strong>Privacy choices</strong>
        <p>Nexauren uses analytics to understand site usage and advertising on Free tool pages. You can allow both or continue with essential features only. <a href="/cookies/">Learn more</a>.</p>
      </div>
      <div class="nx-consent-actions">
        <button class="nx-essential" type="button" data-consent="essential">Essential only</button>
        <button class="nx-accept" type="button" data-consent="accept">Allow analytics & ads</button>
      </div>
    `;

    banner.querySelector('[data-consent="essential"]').addEventListener("click", () => {
      saveConsent(false, false);
      banner.remove();
    });
    banner.querySelector('[data-consent="accept"]').addEventListener("click", () => {
      saveConsent(true, true);
      banner.remove();
    });

    document.body.appendChild(banner);
  };

  const consent = readConsent();
  if (consent?.analytics) loadGoogleAnalytics();
  if (!consent) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner, { once: true });
    } else {
      showBanner();
    }
  }
})();

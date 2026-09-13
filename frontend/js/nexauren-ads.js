(() => {
  const CONSENT_KEY = "nx-consent-v1";
  const ACCOUNT_ENDPOINT = "/api/account";
  const ZONES = ["11177602", "11215522"];
  const SOURCES = [
    "https://n6wxm.com/vignette.min.js",
    "https://nap5k.com/tag.min.js"
  ];

  const readConsent = () => {
    try {
      const value = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  };

  const isPaidPlan = plan => {
    const normalized = String(plan || "free").trim().toLowerCase();
    return normalized !== "" && normalized !== "free";
  };

  const loadAd = (zone, source) => {
    const script = document.createElement("script");
    script.dataset.zone = zone;
    script.async = true;
    script.src = source;
    document.body.appendChild(script);
  };

  const loadAdsForFree = async () => {
    if (window.__nexaurenAdsLoaded) return;

    const consent = readConsent();
    if (!consent?.ads) return;

    try {
      const response = await fetch(ACCOUNT_ENDPOINT, {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (response.ok) {
        const data = await response.json();
        const plan = data?.subscription?.plan_name || "Free";
        if (isPaidPlan(plan)) return;
      } else if (response.status !== 401) {
        return;
      }
    } catch (_) {
      return;
    }

    window.__nexaurenAdsLoaded = true;

    ZONES.forEach((zone, index) => {
      const source = SOURCES[index];
      if (source) loadAd(zone, source);
    });
  };

  const start = () => loadAdsForFree();

  window.addEventListener("nexauren:consent", event => {
    if (event.detail?.ads) start();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

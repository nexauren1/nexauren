(() => {
  const PLAN_ENDPOINT = "/api/tools/sample-pack/limits";
  const ZONES = ["11177602", "11215522"];
  const SOURCES = [
    "https://n6wxm.com/vignette.min.js",
    "https://nap5k.com/tag.min.js"
  ];

  const isIndividualTool = () => {
    const path = window.location.pathname.replace(/\/+$/, "");
    return path.startsWith("/tools/") && path !== "/tools";
  };

  const isIndividualBlogArticle = () => {
    const path = window.location.pathname.replace(/\/+$/, "");
    return /^\/blog\/[^/]+$/.test(path);
  };

  const isAdEligiblePage = () => {
    return isIndividualTool() || isIndividualBlogArticle();
  };

  const isPaidPlan = plan => {
    const value = String(plan || "free").trim().toLowerCase();
    return value === "pro" || value === "premium";
  };

  const loadAd = (zone, source) => {
    if (!source || document.querySelector(`script[data-zone="${zone}"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.dataset.zone = zone;
    script.async = true;
    script.src = source;
    document.body.appendChild(script);
  };

  const loadAdsForFree = async () => {
    if (!isAdEligiblePage() || window.__nexaurenAdsLoaded) {
      return;
    }

    let plan = "free";

    try {
      const response = await fetch(PLAN_ENDPOINT, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (response.ok) {
        const data = await response.json();
        plan =
          data?.plan ||
          data?.subscription?.plan_name ||
          data?.subscription?.plan ||
          "free";
      } else if (response.status !== 401) {
        return;
      }
    } catch (_) {
      return;
    }

    if (isPaidPlan(plan)) {
      return;
    }

    window.__nexaurenAdsLoaded = true;

    ZONES.forEach((zone, index) => {
      loadAd(zone, SOURCES[index]);
    });
  };

  const start = () => {
    loadAdsForFree();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

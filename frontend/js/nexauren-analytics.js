(() => {
  const GA_ID = "G-Y4K8V974Q1";

  if (!GA_ID || window.__nexaurenGA) return;
  window.__nexaurenGA = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  // Advanced Consent Mode: no banner is shown.
  // Analytics remains cookieless until consent is explicitly granted.
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });

  window.gtag("set", "ads_data_redaction", true);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  script.onload = () => {
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      send_page_view: true,
      anonymize_ip: true
    });
  };
  script.onerror = () => {
    window.__nexaurenGA = false;
  };

  document.head.appendChild(script);
})();

(() => {
  const GA_ID = "G-Y4K8V974Q1";

  if (!GA_ID || window.__nexaurenG4A) return;
  window.__nexaurenG4A = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: true,
    anonymize_ip: true
  });

  const script = document.createElement("script");
  script.async = true;
  script.src =
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;

  script.onerror = () => {
    window.__nexaurenG4A = false;
  };

  document.head.appendChild(script);
})();

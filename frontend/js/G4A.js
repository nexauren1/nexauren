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

  // Keep the tools catalogue filters aligned with the master category list.
  // This runs after the existing tools page script without touching its data.
  const categories = [
    ["ai", "AI"],
    ["audio", "Audio"],
    ["image", "Image"],
    ["pdf", "PDF"],
    ["text", "Text"],
    ["productivity", "Productivity"],
    ["business", "Business"],
    ["marketplace", "Marketplace"],
    ["utilities", "Utilities"],
    ["developer", "Developer"],
    ["calculators", "Calculators"],
    ["qr-generators", "QR & Generators"],
    ["seo", "SEO"],
    ["media", "Media"],
    ["converters", "Converters"],
    ["security", "Security"],
    ["files", "Files"],
    ["color", "Color"],
    ["date-time", "Date & Time"],
    ["finance", "Finance"],
    ["education", "Education"]
  ];

  const colors = {
    ai: "#7c3aed",
    audio: "#16a34a",
    image: "#ef4444",
    pdf: "#eab308",
    text: "#2563eb",
    productivity: "#2563eb",
    business: "#16a34a",
    marketplace: "#2563eb",
    utilities: "#667085",
    developer: "#7c3aed",
    calculators: "#2563eb",
    "qr-generators": "#16a34a",
    seo: "#7c3aed",
    media: "#ef4444",
    converters: "#2563eb",
    security: "#16a34a",
    files: "#667085",
    color: "#ef4444",
    "date-time": "#eab308",
    finance: "#16a34a",
    education: "#2563eb"
  };

  function setupToolCategories() {
    const chips = document.getElementById("chips");
    const content = document.getElementById("content");
    const search = document.getElementById("search");
    const count = document.getElementById("categoryCount");
    if (!chips || !content) return;

    const selected = window.__nexaurenToolCategory || "all";
    chips.innerHTML = [
      `<button class="chip ${selected === "all" ? "active" : ""}" data-nx-cat="all"><i style="--chip:#101828"></i>All</button>`,
      ...categories.map(([slug, name]) =>
        `<button class="chip ${selected === slug ? "active" : ""}" data-nx-cat="${slug}"><i style="--chip:${colors[slug]}"></i>${name}</button>`
      )
    ].join("");

    if (count) count.textContent = categories.length;

    chips.querySelectorAll("[data-nx-cat]").forEach((button) => {
      button.addEventListener("click", () => {
        window.__nexaurenToolCategory = button.dataset.nxCat;
        applyToolCategory();
        setupToolCategories();
      });
    });

    applyToolCategory();

    function applyToolCategory() {
      const active = window.__nexaurenToolCategory || "all";
      const query = (search?.value || "").trim().toLowerCase();
      let visible = 0;

      content.querySelectorAll(".category").forEach((section) => {
        const title = section.querySelector("h2")?.textContent?.trim() || "";
        const category = categories.find(([, name]) => name === title)?.[0] || "";
        const matchesCategory = active === "all" || category === active;
        const matchesSearch = !query || section.textContent.toLowerCase().includes(query);
        const show = matchesCategory && matchesSearch;
        section.style.display = show ? "" : "none";
        if (show) visible += section.querySelectorAll(".card").length;
      });

      const toolCount = document.getElementById("toolCount");
      if (toolCount && active !== "all") toolCount.textContent = visible;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    setupToolCategories();

    const content = document.getElementById("content");
    if (content) {
      new MutationObserver(() => setupToolCategories()).observe(content, {
        childList: true
      });
    }
  });
})();

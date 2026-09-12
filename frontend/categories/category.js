import { tools } from "../data/tools.js";

/**
 * Universal category registry for Nexauren tools.
 * One file handles every category automatically.
 */
export function getCategories() {
  const categories = new Map();

  for (const tool of tools) {
    if (!tool.category) continue;

    if (!categories.has(tool.category)) {
      categories.set(tool.category, {
        slug: tool.category,
        name: formatCategoryName(tool.category),
        tools: []
      });
    }

    if (tool.status === "published") {
      categories.get(tool.category).tools.push(tool);
    }
  }

  return [...categories.values()];
}

export function getCategory(categorySlug) {
  return getCategories().find(category => category.slug === categorySlug) || null;
}

export function getToolsForCategory(categorySlug) {
  const category = getCategory(categorySlug);
  return category ? category.tools : [];
}

export function renderCategory(container, categorySlug) {
  if (!container) return;

  const category = getCategory(categorySlug);

  if (!category) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = category.tools.map(renderToolCard).join("");
}

export function renderAllCategories(container) {
  if (!container) return;

  container.innerHTML = getCategories()
    .map(category => `
      <section class="tools-category" data-category="${escapeHtml(category.slug)}">
        <div class="category-header">
          <div>
            <h2>${escapeHtml(category.name)}</h2>
            <span>${category.tools.length} ferramenta${category.tools.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div class="tools-grid">
          ${category.tools.map(renderToolCard).join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderToolCard(tool) {
  return `
    <article class="tool-card" data-tool-id="${escapeHtml(tool.id)}">
      <a class="tool-card-main" href="${escapeHtml(tool.toolPath)}">
        <div class="tool-icon">${escapeHtml(tool.icon || "◈")}</div>
        <div class="tool-info">
          <div class="tool-title-row">
            <h3>${escapeHtml(tool.name)}</h3>
            <span class="tool-status">${escapeHtml(tool.status)}</span>
          </div>
          <p>${escapeHtml(tool.description || "")}</p>
        </div>
      </a>
      <button class="tool-info-button" type="button" aria-label="Informações sobre ${escapeHtml(tool.name)}" data-tool-info="${escapeHtml(tool.id)}">ℹ️</button>
    </article>
  `;
}

export function getToolInfo(toolId) {
  return tools.find(tool => tool.id === toolId) || null;
}

function formatCategoryName(slug) {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

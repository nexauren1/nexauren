import { getToolsByCategory } from "../data/tools.js";

export const category = {
  slug: "audio",
  name: "Audio",
  description: "Ferramentas Nexauren para trabalhar com áudio."
};

export function loadAudioTools() {
  return getToolsByCategory(category.slug);
}

export function renderAudioTools(container) {
  if (!container) return;

  const tools = loadAudioTools();
  container.innerHTML = tools.map(tool => `
    <a class="tool-card" href="${tool.toolPath}">
      <div class="tool-top">
        <span class="icon">${tool.icon}</span>
        <span class="pill">${tool.status}</span>
      </div>
      <h3>${tool.name}</h3>
      <p>${tool.description}</p>
      <div class="tool-action">
        <span>Usar ferramenta</span>
        <span>→</span>
      </div>
    </a>
  `).join("");
}

export const tools = [
  {
    id: "aud-001",
    slug: "audio-converter",
    name: "Audio Converter",
    category: "audio",
    icon: "♫",
    status: "published",
    description: "Converta ficheiros de áudio entre formatos populares com uma experiência rápida e simples.",
    toolPath: "/tools/audio/audio-converter/",
    version: "1.0.0",
    featured: true,
    createdAt: "2026-09-12"
  }
];

export function getToolsByCategory(category) {
  return tools.filter(tool => tool.category === category && tool.status === "published");
}

export function getToolBySlug(slug) {
  return tools.find(tool => tool.slug === slug && tool.status === "published") || null;
}

export function toolPath(category, slug) {
  return `/tools/${category}/${slug}/`;
}

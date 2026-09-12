export const tools = [
  {
    slug: "nexauren-audio-studio",
    name: "Nexauren Audio Studio",
    description: "Editor de áudio no navegador com waveform, reprodução, volume, velocidade, corte e exportação WAV.",
    category: "audio",
    path: "/tools/audio/nexauren-audio-studio/"
  }
];

export function toolPath(category, slug) {
  return `/tools/${category}/${slug}/`;
}

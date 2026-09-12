INSERT OR IGNORE INTO tools (
  slug,
  name,
  description,
  category,
  tool_path,
  html_file,
  js_file,
  css_file,
  published,
  created_at,
  updated_at
) VALUES (
  'sample-pack-generator',
  'Sample Pack Generator',
  'Gere variações únicas de samples de áudio e descarregue um sample pack ZIP.',
  'audio',
  '/tools/audio/sample-pack-generator/',
  'index.html',
  'script.js',
  'style.css',
  1,
  0,
  0
);

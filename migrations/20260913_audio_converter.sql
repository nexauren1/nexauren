INSERT OR IGNORE INTO tools (
  id,
  slug,
  name,
  description,
  category,
  tool_path,
  icon,
  version,
  status,
  published,
  created_at,
  updated_at
) VALUES (
  'aud-003',
  'audio-converter',
  'Audio Converter',
  'Free online audio converter for MP3, WAV, FLAC, OGG and M4A.',
  'audio',
  '/tools/audio/audio-converter/',
  '♫',
  '1.0.0',
  'published',
  1,
  unixepoch(),
  unixepoch()
);

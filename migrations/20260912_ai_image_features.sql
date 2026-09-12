PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO tool_features
(id, tool_slug, feature_key, name, description, required_plan, active, created_at, updated_at)
VALUES
(
  'aiimg-feat-001',
  'ai-image-generator',
  'image-editing',
  'AI Image Editing',
  'Upload an image and transform it with a text instruction.',
  'pro',
  1,
  unixepoch(),
  unixepoch()
),
(
  'aiimg-feat-002',
  'ai-image-generator',
  'variations',
  'Multiple Variations',
  'Create alternative variations from the same idea.',
  'pro',
  1,
  unixepoch(),
  unixepoch()
),
(
  'aiimg-feat-003',
  'ai-image-generator',
  'multi-reference',
  'Multi-Reference Images',
  'Use multiple reference images for advanced image composition.',
  'premium',
  1,
  unixepoch(),
  unixepoch()
),
(
  'aiimg-feat-004',
  'ai-image-generator',
  'creative-control',
  'Advanced Creative Control',
  'Use advanced generation guidance for greater prompt control.',
  'premium',
  1,
  unixepoch(),
  unixepoch()
);

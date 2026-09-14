CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tools (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  tool_path TEXT NOT NULL,
  html_file TEXT DEFAULT 'index.html',
  js_file TEXT DEFAULT 'script.js',
  css_file TEXT DEFAULT 'style.css',
  published INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (category) REFERENCES categories(slug) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_published ON tools(published);
CREATE INDEX IF NOT EXISTS idx_tools_created_by ON tools(created_by);

INSERT OR IGNORE INTO categories (slug,name,description,icon,created_at) VALUES
('audio','Audio','Ferramentas de áudio','audio',0),
('image','Image','Ferramentas de imagem','image',0),
('pdf','PDF','Ferramentas PDF','pdf',0),
('text','Text','Ferramentas de texto','text',0),
('productivity','Productivity','Ferramentas de produtividade','productivity',0),
('business','Business','Ferramentas para negócios','business',0),
('marketplace','Marketplace','Ferramentas do marketplace','marketplace',0),
('utilities','Utilities','Ferramentas utilitárias','utilities',0),
('developer','Developer','Ferramentas para desenvolvimento','developer',0),
('calculators','Calculators','Calculadoras e ferramentas matemáticas','calculators',0),
('qr-generators','QR & Generators','QR codes e geradores','qr-generators',0),
('seo','SEO','Ferramentas de SEO','seo',0),
('media','Media','Ferramentas de mídia','media',0),
('converters','Converters','Conversores de formatos e unidades','converters',0),
('security','Security','Ferramentas de segurança e privacidade','security',0),
('files','Files','Ferramentas para arquivos','files',0),
('color','Color','Ferramentas de cores','color',0),
('date-time','Date & Time','Ferramentas de data e tempo','date-time',0),
('finance','Finance','Ferramentas financeiras','finance',0),
('education','Education','Ferramentas para estudo e educação','education',0);

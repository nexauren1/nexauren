CREATE TABLE IF NOT EXISTS blog_analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER DEFAULT 0,
  country TEXT,
  referrer_host TEXT,
  device_type TEXT,
  browser TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_analytics_post_time
  ON blog_analytics_events(post_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_time
  ON blog_analytics_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_event
  ON blog_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_country
  ON blog_analytics_events(country);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_referrer
  ON blog_analytics_events(referrer_host);

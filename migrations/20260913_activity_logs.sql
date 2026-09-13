CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_user
  ON activity_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_created
  ON activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_activity_user_created
  ON activity_logs(user_id, created_at);

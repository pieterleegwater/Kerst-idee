CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS games_created_at ON games (created_at);

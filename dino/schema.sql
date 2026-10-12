-- CHECK-constraints bewaken de spelregels in de database zelf:
-- je kunt nooit je laatste exemplaar wegruilen en nooit onder 0 pakjes komen.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  pack_credits INTEGER NOT NULL DEFAULT 2 CHECK (pack_credits >= 0),
  credits_at INTEGER NOT NULL,
  premium_until INTEGER NOT NULL DEFAULT 0,
  packs_opened INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 1),
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  give_card TEXT NOT NULL,
  want_card TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS trades_to ON trades (to_user, status);
CREATE INDEX IF NOT EXISTS trades_from ON trades (from_user, created_at);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Genummerde Oerkristal-kaarten: per dino maximaal KRISTAL_CAP exemplaren wereldwijd.
CREATE TABLE IF NOT EXISTS prints (
  card_id TEXT NOT NULL,
  serial INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, serial)
);
CREATE INDEX IF NOT EXISTS prints_user ON prints (user_id);

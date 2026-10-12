-- CHECK-constraints bewaken de spelregels in de database zelf:
-- nooit onder 0 eieren of fossielen, en een kaart met 0 exemplaren bestaat niet (wordt verwijderd).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  pack_credits INTEGER NOT NULL DEFAULT 2 CHECK (pack_credits >= 0),
  credits_at INTEGER NOT NULL,
  premium_until INTEGER NOT NULL DEFAULT 0,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  bought_eggs INTEGER NOT NULL DEFAULT 0 CHECK (bought_eggs >= 0),
  fossils INTEGER NOT NULL DEFAULT 0 CHECK (fossils >= 0)
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

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_user ON payments (user_id, created_at);

-- Genummerde Oerkristal-kaarten: per dino maximaal KRISTAL_CAP exemplaren wereldwijd.
CREATE TABLE IF NOT EXISTS prints (
  card_id TEXT NOT NULL,
  serial INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, serial)
);
CREATE INDEX IF NOT EXISTS prints_user ON prints (user_id);

-- Wie wanneer een account aanmaakte, alleen als hash van het IP-adres (geen IP zelf). Na 30 dagen opgeruimd.
CREATE TABLE IF NOT EXISTS registrations (
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS registrations_ip ON registrations (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS registrations_time ON registrations (created_at);

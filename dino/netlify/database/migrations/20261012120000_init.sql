-- DinoRijk, Postgres-versie van schema.sql (Netlify Database).
-- CHECK-constraints bewaken de spelregels: nooit onder 0 eieren of fossielen, nooit 0 exemplaren van een kaart.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  pack_credits INTEGER NOT NULL DEFAULT 2 CHECK (pack_credits >= 0),
  credits_at BIGINT NOT NULL,
  premium_until BIGINT NOT NULL DEFAULT 0,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  bought_eggs INTEGER NOT NULL DEFAULT 0 CHECK (bought_eggs >= 0),
  fossils INTEGER NOT NULL DEFAULT 0 CHECK (fossils >= 0)
);
CREATE UNIQUE INDEX users_username_lower ON users (lower(username));

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);

CREATE TABLE collection (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 1),
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX payments_user ON payments (user_id, created_at);

CREATE TABLE prints (
  card_id TEXT NOT NULL,
  serial INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (card_id, serial)
);
CREATE INDEX prints_user ON prints (user_id);

// Postgres-schema voor DinoRijk (Supabase). Wordt bij de eerste aanvraag automatisch aangemaakt;
// alles is "IF NOT EXISTS", dus opnieuw uitvoeren kan geen kwaad.
// Row Level Security staat aan zonder policies: zo kan niemand via de publieke Supabase-API
// (met de anon key) bij deze tabellen. Alleen de server, via de databaseverbinding, kan erbij.
export const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
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
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
-- Later toegevoegd: bestaande tabellen krijgen deze kolommen er automatisch bij.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email);
CREATE INDEX IF NOT EXISTS users_score ON users (score DESC);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewarded BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_ip_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quest_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS q_eggs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS q_dust INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS q_rare INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quests_claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS realms_claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS goals_claimed INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pulls (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_key TEXT NOT NULL,
  serial INTEGER,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS pulls_time ON pulls (created_at);
CREATE INDEX IF NOT EXISTS users_referred_by ON users (referred_by, referral_rewarded);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets (user_id, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
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
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_user ON payments (user_id, created_at);

CREATE TABLE IF NOT EXISTS prints (
  card_id TEXT NOT NULL,
  serial INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (card_id, serial)
);
CREATE INDEX IF NOT EXISTS prints_user ON prints (user_id);

CREATE TABLE IF NOT EXISTS registrations (
  ip_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS registrations_ip ON registrations (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS registrations_time ON registrations (created_at);

CREATE TABLE IF NOT EXISTS locks (
  name TEXT PRIMARY KEY,
  at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS login_fails (
  key_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_fails_key ON login_fails (key_hash, created_at);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prints ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_fails ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulls ENABLE ROW LEVEL SECURITY;
`;

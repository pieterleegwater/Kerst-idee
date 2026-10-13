-- CHECK-constraints bewaken de spelregels in de database zelf:
-- nooit onder 0 eieren of fossielen, en een kaart met 0 exemplaren bestaat niet (wordt verwijderd).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  pack_credits INTEGER NOT NULL DEFAULT 2 CHECK (pack_credits >= 0),
  credits_at INTEGER NOT NULL,
  premium_until INTEGER NOT NULL DEFAULT 0,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  bought_eggs INTEGER NOT NULL DEFAULT 0 CHECK (bought_eggs >= 0),
  fossils INTEGER NOT NULL DEFAULT 0 CHECK (fossils >= 0),
  score INTEGER NOT NULL DEFAULT 0,
  -- Uitnodigen: wie nodigde jou uit, wanneer leverde dat de uitnodiger een ei op (0 = nog niet), hash van je aanmeld-IP.
  referred_by TEXT,
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  reg_ip_hash TEXT,
  -- Dagelijkse beloning: hoeveelste dag op rij, en op welke dag (dagnummer, Nederlandse tijd) voor het laatst opgehaald.
  streak INTEGER NOT NULL DEFAULT 0,
  streak_day INTEGER NOT NULL DEFAULT 0,
  -- Dagelijkse opdrachten (tellers van vandaag) en verzameldoelen (bitmaskers: welke beloningen al opgehaald).
  quest_day INTEGER NOT NULL DEFAULT 0,
  q_eggs INTEGER NOT NULL DEFAULT 0,
  q_dust INTEGER NOT NULL DEFAULT 0,
  q_rare INTEGER NOT NULL DEFAULT 0,
  quests_claimed INTEGER NOT NULL DEFAULT 0,
  realms_claimed INTEGER NOT NULL DEFAULT 0,
  goals_claimed INTEGER NOT NULL DEFAULT 0,
  -- Geluksmeter: eieren sinds de laatste Legendarische kaart.
  since_legend INTEGER NOT NULL DEFAULT 0,
  -- Gouden Eieren (betere kansen), alleen te koop.
  gold_eggs INTEGER NOT NULL DEFAULT 0 CHECK (gold_eggs >= 0)
);
CREATE INDEX IF NOT EXISTS users_referred_by ON users (referred_by, referral_rewarded);
CREATE INDEX IF NOT EXISTS users_score ON users (score DESC);

-- Wachtwoord-resetlinks: alleen een hash van de link wordt bewaard.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets (user_id, created_at);

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

-- Eén rij per naam; een upsert hierop laat gelijktijdige verzoeken netjes op elkaar wachten.
CREATE TABLE IF NOT EXISTS locks (
  name TEXT PRIMARY KEY,
  at INTEGER NOT NULL DEFAULT 0
);

-- Mislukte inlogpogingen (alleen hashes), om wachtwoorden raden af te remmen.
CREATE TABLE IF NOT EXISTS login_fails (
  key_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_fails_key ON login_fails (key_hash, created_at);

-- Bijzondere vondsten voor de live-balk (een week bewaard).
CREATE TABLE IF NOT EXISTS pulls (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_key TEXT NOT NULL,
  serial INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pulls_time ON pulls (created_at);

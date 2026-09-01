PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  -- Empreinte argon2id auto-decrite ($argon2id$v=19$m=...,t=...,p=...$...) :
  -- les parametres de cout voyagent avec l'empreinte, un durcissement futur
  -- reste retro-compatible avec les comptes existants.
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  -- Le profil de mobilite est un agregat de preferences lu et ecrit en bloc :
  -- aucune requete ne porte sur un champ isole, JSON est ici le bon grain.
  profile_json  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  -- Seule l'empreinte SHA-256 du jeton est stockee : une fuite de la base ne
  -- permet pas de rejouer une session.
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS trip_records (
  id                 TEXT NOT NULL,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_title        TEXT NOT NULL,
  modes              TEXT NOT NULL,
  distance_km        REAL NOT NULL,
  duration_minutes   REAL NOT NULL,
  carbon_grams       REAL NOT NULL,
  carbon_saved_grams REAL NOT NULL,
  created_at         TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_trip_records_user_date ON trip_records(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS planned_trips (
  id                 TEXT NOT NULL,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  origin_label       TEXT NOT NULL,
  origin_lat         REAL NOT NULL,
  origin_lon         REAL NOT NULL,
  destination_label  TEXT NOT NULL,
  destination_lat    REAL NOT NULL,
  destination_lon    REAL NOT NULL,
  modes              TEXT NOT NULL,
  distance_km        REAL NOT NULL,
  duration_minutes   REAL NOT NULL,
  carbon_grams       REAL NOT NULL,
  carbon_saved_grams REAL NOT NULL,
  scheduled_for      TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('planned','done','cancelled')),
  recurring_trip_id  TEXT,
  created_at         TEXT NOT NULL,
  completed_at       TEXT,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_planned_user_schedule ON planned_trips(user_id, scheduled_for);

CREATE TABLE IF NOT EXISTS recurring_trips (
  id                 TEXT NOT NULL,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  origin_label       TEXT NOT NULL,
  origin_lat         REAL NOT NULL,
  origin_lon         REAL NOT NULL,
  destination_label  TEXT NOT NULL,
  destination_lat    REAL NOT NULL,
  destination_lon    REAL NOT NULL,
  modes              TEXT NOT NULL,
  distance_km        REAL NOT NULL,
  duration_minutes   REAL NOT NULL,
  carbon_grams       REAL NOT NULL,
  carbon_saved_grams REAL NOT NULL,
  days_of_week       TEXT NOT NULL,
  departure_time     TEXT NOT NULL,
  return_time        TEXT,
  paused             INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS saved_routes (
  id                 TEXT NOT NULL,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id           TEXT NOT NULL,
  route_title        TEXT NOT NULL,
  origin_label       TEXT NOT NULL,
  origin_lat         REAL NOT NULL,
  origin_lon         REAL NOT NULL,
  destination_label  TEXT NOT NULL,
  destination_lat    REAL NOT NULL,
  destination_lon    REAL NOT NULL,
  modes              TEXT NOT NULL,
  distance_km        REAL NOT NULL,
  duration_minutes   REAL NOT NULL,
  carbon_grams       REAL NOT NULL,
  carbon_saved_grams REAL NOT NULL,
  score              REAL NOT NULL,
  created_at         TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

-- Journal des operations de synchronisation deja appliquees : le client peut
-- rejouer sa file d'attente sans risque de doublon (idempotence). Le journal
-- est purge au-dela de la fenetre de retention, sinon il grossit sans fin.
CREATE TABLE IF NOT EXISTS applied_operations (
  id         TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_applied_operations_date ON applied_operations(applied_at);

-- Traces de voirie deja calcules. Le cache est partage par tous les clients :
-- une recherche frequente n'atteint la source qu'une fois, ce qui protege le
-- quota du fournisseur et rend l'application utilisable quand il refuse de
-- repondre (eco-conception, et B13).
--
-- La cle porte les coordonnees arrondies a cinq decimales, soit environ un
-- metre : deux departs distants d'un metre suivent la meme rue, inutile de
-- calculer deux fois.
CREATE TABLE IF NOT EXISTS route_cache (
  cache_key        TEXT PRIMARY KEY,
  mode             TEXT NOT NULL,
  payload_json     TEXT NOT NULL,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_route_cache_date ON route_cache(created_at);

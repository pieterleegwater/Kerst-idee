// Verbinding met de Supabase-database (Postgres) vanuit Netlify Functions.
// Zet SUPABASE_DB_URL op de "Transaction pooler"-URI uit Supabase (Connect → Transaction pooler).
import pg from "pg";
import { PG_SCHEMA } from "./pg-schema.js";

let pool;
let schemaReady;

export class MissingDatabaseUrl extends Error {}

// Leest postgresql://gebruiker:wachtwoord@host:poort/database zelf uit, zodat een wachtwoord met
// tekens als # / ? @ of spaties niet het adres breekt (een gewone URL-parser knipt daar verkeerd).
export function parseDbUrl(raw) {
  const url = String(raw || "").trim();
  const m = url.match(/^postgres(?:ql)?:\/\/([^:@\/]+)(?::(.*))?@([^@\/:?#]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?.*)?$/s);
  if (!m) return null;
  const decode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v; // niet-gecodeerde % of andere tekens: letterlijk gebruiken
    }
  };
  return { user: decode(m[1]), password: m[2] == null ? undefined : decode(m[2]), host: m[3], port: Number(m[4] || 5432), database: decode(m[5] || "postgres") };
}

export function supabasePool() {
  if (pool) return pool;
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) throw new MissingDatabaseUrl("SUPABASE_DB_URL ontbreekt");
  const cfg = parseDbUrl(raw);
  if (!cfg) throw new Error("SUPABASE_DB_URL heeft niet de vorm postgresql://gebruiker:wachtwoord@host:poort/database");
  // SUPABASE_DB_SSL=false alleen voor lokaal testen zonder SSL.
  const ssl = process.env.SUPABASE_DB_SSL === "false" ? false : { rejectUnauthorized: false };
  pool = new pg.Pool({ ...cfg, ssl, max: 3, idleTimeoutMillis: 10000 });
  return pool;
}

// Tabellen één keer per functie-instantie aanmaken (als ze er nog niet zijn).
export function ensureSchema() {
  schemaReady ??= supabasePool()
    .query(PG_SCHEMA)
    .catch((err) => {
      schemaReady = null; // volgende keer opnieuw proberen
      throw err;
    });
  return schemaReady;
}

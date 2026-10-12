// Verbinding met de Supabase-database (Postgres) vanuit Netlify Functions.
// Zet SUPABASE_DB_URL op de "Transaction pooler"-URI uit Supabase (Connect → Transaction pooler).
import pg from "pg";
import { PG_SCHEMA } from "./pg-schema.js";

let pool;
let schemaReady;

export class MissingDatabaseUrl extends Error {}

export function supabasePool() {
  if (pool) return pool;
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new MissingDatabaseUrl("SUPABASE_DB_URL ontbreekt");
  // sslmode uit de URL halen: we zetten SSL hieronder zelf aan.
  const connectionString = url.replace(/[?&]sslmode=[^&]*/, "");
  // SUPABASE_DB_SSL=false alleen voor lokaal testen zonder SSL.
  const ssl = process.env.SUPABASE_DB_SSL === "false" ? false : { rejectUnauthorized: false };
  pool = new pg.Pool({ connectionString, ssl, max: 3, idleTimeoutMillis: 10000 });
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

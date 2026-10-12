// Netlify Function: alle /api/*-verzoeken van DinoRijk. Database: Supabase (Postgres).
import { createApp } from "../../src/app.js";
import { pgDatabase } from "../../src/pg.js";
import { createMollie } from "../../src/mollie.js";
import { supabasePool, ensureSchema, MissingDatabaseUrl } from "../../src/supabase.js";
import { statusResponse } from "../../src/status.js";

let app;

export default async (request) => {
  if (new URL(request.url).pathname === "/api/status") return statusResponse();
  try {
    await ensureSchema();
  } catch (err) {
    console.error("Database niet bereikbaar:", err.message);
    const msg = err instanceof MissingDatabaseUrl ? "De database is nog niet gekoppeld (SUPABASE_DB_URL ontbreekt)." : "De database is even niet bereikbaar. Probeer het zo opnieuw.";
    return Response.json({ error: msg }, { status: 503 });
  }
  app ??= createApp({
    db: pgDatabase(supabasePool()),
    mollie: process.env.MOLLIE_API_KEY ? createMollie(process.env.MOLLIE_API_KEY) : null,
  });
  return app(request);
};

export const config = { path: "/api/*" };

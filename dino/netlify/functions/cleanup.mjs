// Dagelijks opruimen: verlopen sessies en registratie-hashes ouder dan 30 dagen.
import { supabasePool, ensureSchema } from "../../src/supabase.js";

export default async () => {
  await ensureSchema();
  await supabasePool().query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
  await supabasePool().query("DELETE FROM registrations WHERE created_at < $1", [Date.now() - 30 * 24 * 3600 * 1000]);
  await supabasePool().query("DELETE FROM password_resets WHERE expires_at < $1", [Date.now() - 24 * 3600 * 1000]);
};

export const config = { schedule: "@daily" };

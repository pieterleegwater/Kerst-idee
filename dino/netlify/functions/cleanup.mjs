// Dagelijks verlopen sessies opruimen.
import { supabasePool, ensureSchema } from "../../src/supabase.js";

export default async () => {
  await ensureSchema();
  await supabasePool().query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
};

export const config = { schedule: "@daily" };

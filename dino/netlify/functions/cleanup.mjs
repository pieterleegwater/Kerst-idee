// Dagelijks verlopen sessies opruimen.
import { getDatabase } from "@netlify/database";

export default async () => {
  await getDatabase().pool.query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
};

export const config = { schedule: "@daily" };

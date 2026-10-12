// /api/status: laat zien aan welke database en welke Mollie-modus deze site hangt.
// Toont geen wachtwoorden of sleutels, alleen het Supabase-project en aantallen.
import { supabasePool, ensureSchema, parseDbUrl } from "./supabase.js";

export async function statusResponse() {
  const url = process.env.SUPABASE_DB_URL || "";
  const key = process.env.MOLLIE_API_KEY || "";
  const status = {
    site: process.env.URL || null,
    mollie: key.startsWith("live_") ? "live (echte betalingen)" : key.startsWith("test_") ? "test (Mollie testbetalingen)" : "uit: demo-modus, kopen is gratis!",
    database: { gekoppeld: false },
  };
  if (!url) {
    status.database.melding = "SUPABASE_DB_URL ontbreekt in Netlify (Environment variables).";
    return Response.json(status, { status: 503 });
  }
  try {
    const u = parseDbUrl(url);
    if (!u) {
      status.database.melding = "SUPABASE_DB_URL heeft niet de goede vorm. Verwacht: postgresql://postgres.<project>:<wachtwoord>@<regio>.pooler.supabase.com:6543/postgres";
      return Response.json(status, { status: 503 });
    }
    // Supabase-pooler: gebruiker "postgres.<projectref>"; directe verbinding: host "db.<projectref>.supabase.co".
    const ref = u.user.split(".")[1] || u.host.match(/^db\.([^.]+)\.supabase\.co$/)?.[1] || null;
    status.database.host = u.host;
    status.database.poort = u.port;
    status.database.wachtwoord_ingevuld = Boolean(u.password) && !/YOUR-PASSWORD/i.test(u.password);
    status.database.supabaseProject = ref;
    status.database.dashboard = ref ? `https://supabase.com/dashboard/project/${ref}/editor` : null;
    status.database.klopt_met_SUPABASE_URL = process.env.SUPABASE_URL && ref ? process.env.SUPABASE_URL.includes(ref) : null;
    await ensureSchema();
    const { rows } = await supabasePool().query(
      "SELECT (SELECT COUNT(*) FROM users) AS accounts, (SELECT COUNT(*) FROM collection) AS kaartregels, (SELECT COUNT(*) FROM payments WHERE status = 'paid') AS betalingen"
    );
    status.database.gekoppeld = true;
    status.database.aantallen = Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
    return Response.json(status);
  } catch (err) {
    status.database.melding = `Verbinding mislukt: ${err.message}`;
    return Response.json(status, { status: 503 });
  }
}

import { createApp } from "./app.js";
import { createMollie } from "./mollie.js";
import { createMailer } from "./mail.js";

// Cloudflare Worker. public/ wordt als statische site geserveerd; /api/* komt hier binnen.
export default {
  async fetch(request, env) {
    const app = createApp({ db: env.DB, mollie: env.MOLLIE_API_KEY ? createMollie(env.MOLLIE_API_KEY) : null, ipSalt: env.IP_SALT || undefined, mailer: createMailer(env.RESEND_API_KEY, env.MAIL_FROM || "DinoRijk <noreply@example.com>") });
    return app(request);
  },

  // Elke nacht verlopen sessies opruimen.
  async scheduled(_event, env) {
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()).run();
    await env.DB.prepare("DELETE FROM registrations WHERE created_at < ?").bind(Date.now() - 30 * 24 * 3600 * 1000).run();
    await env.DB.prepare("DELETE FROM login_fails WHERE created_at < ?").bind(Date.now() - 24 * 3600 * 1000).run();
    await env.DB.prepare("DELETE FROM payments WHERE status = 'reserving' AND created_at < ?").bind(Date.now() - 3600 * 1000).run();
  },
};

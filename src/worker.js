import { createApp, RETENTION_DAYS } from "./app.js";
import { d1Store } from "./store.js";
import { createMollie } from "./mollie.js";
import { generateGame } from "../lib/generate.js";

// Cloudflare Worker. Statische bestanden uit public/ serveert Cloudflare zelf;
// alleen /api/* komt hier binnen.
export default {
  async fetch(request, env) {
    const app = createApp({
      store: d1Store(env.DB),
      generate: (input) => generateGame(input, { apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || undefined }),
      mollie: env.MOLLIE_API_KEY ? createMollie(env.MOLLIE_API_KEY) : null,
    });
    return app(request);
  },

  // Dagelijkse opruiming (AVG): spellen ouder dan RETENTION_DAYS verwijderen.
  async scheduled(_event, env) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await d1Store(env.DB).deleteOlderThan(cutoff);
  },
};

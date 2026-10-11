import { InputSchema } from "../lib/schema.js";
import { centsToMollie } from "./mollie.js";

// Prijzen in centen. Pas hier aan om te experimenteren.
export const PLANS = {
  familie: { label: "Familie-editie", price: 995, maxMembers: 15 },
  team: { label: "Team-editie (kerstborrel)", price: 3900, maxMembers: 40 },
};

export const RETENTION_DAYS = 60;

const isValidId = (id) => /^[0-9a-f-]{36}$/.test(id);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

// Gratis voorproefje: de eerste 3 vragen van de eerste ronde, rest verborgen.
function publicView(record, demoMode) {
  const { game, paid, plan, id, input } = record;
  if (paid) return { id, paid, plan, groupName: input.groupName, game };
  const [first, ...rest] = game.rounds;
  return {
    id,
    paid,
    plan,
    groupName: input.groupName,
    price: PLANS[plan].price,
    demoMode,
    game: {
      title: game.title,
      intro: game.intro,
      rounds: [
        { ...first, questions: first.questions.slice(0, 3) },
        ...rest.map((r) => ({ title: r.title, kind: r.kind, explanation: r.explanation, locked: true, count: r.questions.length })),
      ],
      lockedQuestions: first.questions.length - 3 + rest.reduce((n, r) => n + r.questions.length, 0),
    },
  };
}

// Simpele rate limit per IP (per Worker-instantie) zodat niemand je AI-tegoed leegtrekt.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  hits.set(ip, [...recent, now]);
  return recent.length >= 10;
}

/**
 * @param {object} deps
 * @param {ReturnType<import("./store.js").memoryStore>} deps.store
 * @param {(input: object) => Promise<object>} deps.generate
 * @param {ReturnType<import("./mollie.js").createMollie> | null} deps.mollie  null = demo-modus
 */
export function createApp({ store, generate, mollie }) {
  const demoMode = !mollie;

  async function markPaidIfMollieSaysSo(record, paymentId) {
    if (record.paid || !mollie || !paymentId) return record;
    const payment = await mollie.getPayment(paymentId);
    if (payment.status === "paid" && payment.metadata?.gameId === record.id) {
      record.paid = true;
      record.paidAt = new Date().toISOString();
      await store.put(record);
    }
    return record;
  }

  const routes = {
    "GET /api/config": async () => json({ plans: PLANS, demoMode }),

    "POST /api/games": async (req) => {
      if (rateLimited(req.headers.get("CF-Connecting-IP") || "local")) {
        return json({ error: "Te veel spellen in korte tijd. Probeer het over een uur opnieuw." }, 429);
      }
      const parsed = InputSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return json({ error: "Controleer het formulier: vul minstens 2 namen in." }, 400);
      const input = parsed.data;
      const plan = PLANS[input.plan];
      if (input.members.length > plan.maxMembers) {
        return json({ error: `De ${plan.label} is voor maximaal ${plan.maxMembers} personen.` }, 400);
      }
      const game = await generate(input);
      const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), plan: input.plan, input, game, paid: false };
      await store.put(record);
      return json({ id: record.id });
    },

    "GET /api/games/:id": async (_req, record) => json(publicView(record, demoMode)),

    "POST /api/games/:id/checkout": async (req, record) => {
      if (record.paid) return json({ url: `/spel?id=${record.id}` });

      if (demoMode) {
        // Zonder Mollie-sleutel: direct ontgrendelen zodat je de hele flow kunt testen.
        record.paid = true;
        record.paidAt = new Date().toISOString();
        await store.put(record);
        return json({ url: `/spel?id=${record.id}` });
      }

      const origin = new URL(req.url).origin;
      const plan = PLANS[record.plan];
      const payment = await mollie.createPayment({
        amount: { currency: "EUR", value: centsToMollie(plan.price) },
        description: `Kerstspel op maat: ${plan.label}`,
        redirectUrl: `${origin}/spel?id=${record.id}&betaald=1`,
        // Mollie kan localhost niet bereiken; lokaal controleren we bij terugkeer.
        ...(origin.startsWith("https://") ? { webhookUrl: `${origin}/api/mollie/webhook` } : {}),
        locale: "nl_NL",
        metadata: { gameId: record.id },
      });
      record.paymentId = payment.id;
      await store.put(record);
      return json({ url: payment._links.checkout.href });
    },

    // Na terugkomst van Mollie: betaling server-side controleren.
    "POST /api/games/:id/verify": async (_req, record) => {
      await markPaidIfMollieSaysSo(record, record.paymentId);
      return json(publicView(record, demoMode));
    },

    // Mollie stuurt hier alleen het betaling-id heen; de status halen we zelf op.
    "POST /api/mollie/webhook": async (req) => {
      if (!mollie) return new Response("ok");
      const form = await req.formData().catch(() => null);
      const paymentId = form?.get("id");
      if (!paymentId) return new Response("ok");
      const payment = await mollie.getPayment(paymentId);
      const gameId = payment.metadata?.gameId;
      const record = gameId && isValidId(gameId) ? await store.get(gameId) : null;
      if (record) await markPaidIfMollieSaysSo(record, paymentId);
      return new Response("ok");
    },
  };

  return async function handle(req) {
    const { pathname } = new URL(req.url);
    const gameMatch = pathname.match(/^\/api\/games\/([^/]+)(\/\w+)?$/);
    const key = `${req.method} ${gameMatch ? `/api/games/:id${gameMatch[2] || ""}` : pathname}`;
    const route = routes[key];
    if (!route) return json({ error: "Niet gevonden." }, 404);

    try {
      if (!gameMatch || key === "POST /api/games") return await route(req);
      const record = isValidId(gameMatch[1]) ? await store.get(gameMatch[1]) : null;
      if (!record) return json({ error: "Spel niet gevonden." }, 404);
      return await route(req, record);
    } catch (err) {
      console.error(err);
      return json({ error: "Er ging iets mis. Probeer het nog eens." }, 500);
    }
  };
}

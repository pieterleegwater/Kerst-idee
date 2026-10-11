import express from "express";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InputSchema } from "./lib/schema.js";
import { generateGame } from "./lib/generate.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data", "games");
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Prijzen in centen. Pas hier aan om te experimenteren.
export const PLANS = {
  familie: { label: "Familie-editie", price: 995, maxMembers: 15 },
  team: { label: "Team-editie (kerstborrel)", price: 3900, maxMembers: 40 },
};

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const DEMO_MODE = !stripe;

await mkdir(DATA_DIR, { recursive: true });

const gameFile = (id) => path.join(DATA_DIR, `${id}.json`);
const isValidId = (id) => /^[0-9a-f-]{36}$/.test(id);

async function loadGame(id) {
  if (!isValidId(id)) return null;
  try {
    return JSON.parse(await readFile(gameFile(id), "utf8"));
  } catch {
    return null;
  }
}
const saveGame = (record) => writeFile(gameFile(record.id), JSON.stringify(record, null, 2));

// Gratis voorproefje: de eerste 3 vragen van de eerste ronde, rest verborgen.
function publicView(record) {
  const { game, paid, plan, id, input } = record;
  if (paid) return { id, paid, plan, groupName: input.groupName, game };
  const [first, ...rest] = game.rounds;
  return {
    id,
    paid,
    plan,
    groupName: input.groupName,
    price: PLANS[plan].price,
    demoMode: DEMO_MODE,
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

// Eenvoudige rate limit zodat niemand je AI-tegoed leegtrekt.
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 10) return res.status(429).json({ error: "Te veel spellen in korte tijd. Probeer het over een uur opnieuw." });
  hits.set(key, [...recent, now]);
  next();
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(ROOT, "public")));

app.get("/api/config", (_req, res) => res.json({ plans: PLANS, demoMode: DEMO_MODE }));

app.post("/api/games", rateLimit, async (req, res) => {
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Controleer het formulier: vul minstens 2 namen in." });
  const input = parsed.data;
  if (input.members.length > PLANS[input.plan].maxMembers) {
    return res.status(400).json({ error: `De ${PLANS[input.plan].label} is voor maximaal ${PLANS[input.plan].maxMembers} personen.` });
  }
  const game = await generateGame(input);
  const record = { id: randomUUID(), createdAt: new Date().toISOString(), plan: input.plan, input, game, paid: false };
  await saveGame(record);
  res.json({ id: record.id });
});

app.get("/api/games/:id", async (req, res) => {
  const record = await loadGame(req.params.id);
  if (!record) return res.status(404).json({ error: "Spel niet gevonden." });
  res.json(publicView(record));
});

app.post("/api/games/:id/checkout", async (req, res) => {
  const record = await loadGame(req.params.id);
  if (!record) return res.status(404).json({ error: "Spel niet gevonden." });
  if (record.paid) return res.json({ url: `/spel.html?id=${record.id}` });

  if (DEMO_MODE) {
    // Zonder Stripe-sleutel: direct ontgrendelen zodat je de hele flow kunt testen.
    record.paid = true;
    record.paidAt = new Date().toISOString();
    await saveGame(record);
    return res.json({ url: `/spel.html?id=${record.id}` });
  }

  const plan = PLANS[record.plan];
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["ideal", "card", "bancontact"],
    locale: "nl",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: plan.price,
          product_data: { name: `Kerstspel op maat: ${plan.label}`, description: record.game.title },
        },
      },
    ],
    metadata: { gameId: record.id },
    success_url: `${BASE_URL}/spel.html?id=${record.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/spel.html?id=${record.id}`,
  });
  record.checkoutSessionId = session.id;
  await saveGame(record);
  res.json({ url: session.url });
});

// Na terugkomst van Stripe: betaling server-side controleren.
app.post("/api/games/:id/verify", async (req, res) => {
  const record = await loadGame(req.params.id);
  if (!record) return res.status(404).json({ error: "Spel niet gevonden." });
  if (!record.paid && stripe && req.body?.sessionId) {
    const session = await stripe.checkout.sessions.retrieve(req.body.sessionId);
    if (session.metadata?.gameId === record.id && session.payment_status === "paid") {
      record.paid = true;
      record.paidAt = new Date().toISOString();
      record.customerEmail = session.customer_details?.email || null;
      await saveGame(record);
    }
  }
  res.json(publicView(record));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Er ging iets mis. Probeer het nog eens." });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Kerstspel op maat draait op ${BASE_URL}`);
    if (DEMO_MODE) console.log("DEMO-modus: geen STRIPE_SECRET_KEY, spellen worden zonder betaling ontgrendeld.");
    if (!process.env.ANTHROPIC_API_KEY) console.log("Geen ANTHROPIC_API_KEY: spellen worden met de ingebouwde sjablonen gemaakt.");
  });
}

export default app;

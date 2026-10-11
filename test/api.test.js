import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { memoryStore } from "../src/store.js";
import { fallbackGame } from "../lib/generate.js";

const BASE = "https://kerstspel.example";

function setup({ mollie = null } = {}) {
  const store = memoryStore();
  const app = createApp({ store, generate: async (input) => fallbackGame(input), mollie });
  const call = (method, path, body, headers = { "Content-Type": "application/json" }) =>
    app(new Request(BASE + path, { method, headers, body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body) }));
  return { store, call };
}

// Nep-Mollie die bijhoudt wat er gevraagd is.
function fakeMollie() {
  const payments = new Map();
  return {
    payments,
    async createPayment(body) {
      const id = `tr_${payments.size + 1}`;
      payments.set(id, { id, status: "open", ...body });
      return { id, _links: { checkout: { href: `https://www.mollie.com/checkout/${id}` } } };
    },
    async getPayment(id) {
      return payments.get(id);
    },
  };
}

const input = {
  plan: "familie",
  groupName: "de Jansens",
  members: [
    { name: "Peter", facts: "raakte drie keer de autosleutels kwijt; kan niet tegen spruitjes" },
    { name: "Sanne", facts: "is verhuisd naar Utrecht" },
    { name: "Oma Riet", facts: "won de bingo in het buurthuis" },
    { name: "Kees", facts: "" },
  ],
  yearHighlights: "Opa werd 80\nDe hond at de taart op",
};

test("demo-modus: voorproefje, daarna direct ontgrendeld", async () => {
  const { call } = setup();
  const { id } = await (await call("POST", "/api/games", input)).json();

  const preview = await (await call("GET", `/api/games/${id}`)).json();
  assert.equal(preview.paid, false);
  assert.equal(preview.demoMode, true);
  assert.equal(preview.game.rounds[0].questions.length, 3);
  assert.ok(preview.game.rounds.slice(1).every((r) => r.locked && !r.questions));
  assert.equal(preview.game.finale, undefined);
  for (const q of preview.game.rounds[0].questions) if (q.options.length) assert.ok(q.options.includes(q.answer));

  await call("POST", `/api/games/${id}/checkout`);
  const full = await (await call("GET", `/api/games/${id}`)).json();
  assert.equal(full.paid, true);
  assert.equal(full.game.rounds.length, 4);
});

test("Mollie: pas ontgrendeld als de betaling echt 'paid' is", async () => {
  const mollie = fakeMollie();
  const { call } = setup({ mollie });
  const { id } = await (await call("POST", "/api/games", input)).json();

  const { url } = await (await call("POST", `/api/games/${id}/checkout`)).json();
  assert.match(url, /mollie\.com\/checkout\/tr_1/);
  const payment = mollie.payments.get("tr_1");
  assert.deepEqual(payment.amount, { currency: "EUR", value: "9.95" });
  assert.equal(payment.metadata.gameId, id);
  assert.equal(payment.redirectUrl, `${BASE}/spel?id=${id}&betaald=1`);
  assert.equal(payment.webhookUrl, `${BASE}/api/mollie/webhook`);

  // Terug van Mollie maar nog niet betaald: blijft op slot.
  assert.equal((await (await call("POST", `/api/games/${id}/verify`)).json()).paid, false);

  // Mollie meldt via webhook dat er betaald is.
  payment.status = "paid";
  const hook = await call("POST", "/api/mollie/webhook", "id=tr_1", { "Content-Type": "application/x-www-form-urlencoded" });
  assert.equal(hook.status, 200);
  const full = await (await call("GET", `/api/games/${id}`)).json();
  assert.equal(full.paid, true);
  assert.ok(full.game.finale);
});

test("weigert ongeldige invoer en onbekende spellen", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "/api/games", { groupName: "x", members: [{ name: "a" }] })).status, 400);
  assert.equal((await call("GET", "/api/games/bestaat-niet")).status, 404);
  assert.equal((await call("POST", "/api/games/00000000-0000-0000-0000-000000000000/checkout")).status, 404);
});

test("opruimen verwijdert oude spellen", async () => {
  const store = memoryStore();
  await store.put({ id: "oud", createdAt: "2025-01-01T00:00:00.000Z" });
  await store.put({ id: "nieuw", createdAt: "2026-12-01T00:00:00.000Z" });
  await store.deleteOlderThan("2026-01-01T00:00:00.000Z");
  assert.equal(await store.get("oud"), null);
  assert.ok(await store.get("nieuw"));
});

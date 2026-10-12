import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp, RULES, packState } from "../src/app.js";
import { CARDS, BY_RARITY, drawPack, PACK_SIZE, parseKey, KRISTAL_CAP } from "../src/cards.js";
import { testDb } from "./d1.js";

const BASE = "https://dinorijk.example";
const HOUR = 3600 * 1000;

function setup({ mollie = null, random } = {}) {
  const db = testDb();
  let clock = Date.UTC(2026, 10, 1);
  const app = createApp({ db, mollie, now: () => clock, ...(random ? { random } : {}) });
  const client = () => {
    let cookie = "";
    const call = async (method, path, body, headers = {}) => {
      const res = await app(
        new Request(BASE + path, {
          method,
          headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), Cookie: cookie, ...headers },
          body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        })
      );
      const set = res.headers.get("Set-Cookie");
      if (set) cookie = set.split(";")[0];
      return { status: res.status, body: res.headers.get("Content-Type")?.includes("json") ? await res.json() : await res.text() };
    };
    return call;
  };
  return { db, client, tick: (ms) => (clock += ms), now: () => clock };
}

async function register(call, username) {
  const r = await call("POST", "/api/register", { username, password: "geheim123", adult: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
}

// Geef een gebruiker direct kaarten (testhulp).
async function give(db, username, cardId, count) {
  const { id } = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  await db.prepare("INSERT INTO collection (user_id, card_id, count) VALUES (?, ?, ?) ON CONFLICT (user_id, card_id) DO UPDATE SET count = excluded.count").bind(id, cardId, count).run();
}

test("catalogus: 96 unieke dino's, 6 rijken × 16, met echte soort en weetje", () => {
  assert.equal(CARDS.length, 96);
  assert.equal(new Set(CARDS.map((c) => c.name)).size, 96);
  assert.equal(BY_RARITY.icoon.length, 6);
  assert.ok(CARDS.every((c) => c.species && c.fact && c.type));
});

test("pakje: 5 kaarten, laatste minimaal Zilver", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const pack = drawPack(rand);
    assert.equal(pack.length, PACK_SIZE);
    assert.notEqual(parseKey(pack[4]).card.rarity, "brons");
  }
});

test("registreren vereist 18+ en unieke naam; inloggen werkt", async () => {
  const { client } = setup();
  const a = client();
  assert.equal((await a("POST", "/api/register", { username: "jan", password: "geheim123" })).status, 400);
  await register(a, "jan");
  assert.equal((await client()("POST", "/api/register", { username: "JAN", password: "geheim123", adult: true })).status, 409);
  const b = client();
  assert.equal((await b("POST", "/api/login", { username: "jan", password: "fout-fout" })).status, 401);
  assert.equal((await b("POST", "/api/login", { username: "jan", password: "geheim123" })).status, 200);
  assert.equal((await b("GET", "/api/me")).body.username, "jan");
  assert.equal((await client()("GET", "/api/me")).status, 401);
});

test("gratis pakjes: 2 bij start, daarna 1 per 12 uur", async () => {
  const { client, tick } = setup();
  const a = client();
  await register(a, "piet");
  assert.equal((await a("POST", "/api/packs/open")).body.cards.length, 5);
  await a("POST", "/api/packs/open");
  assert.equal((await a("POST", "/api/packs/open")).status, 429);

  const me = (await a("GET", "/api/me")).body;
  assert.equal(Object.values(me.collection).reduce((s, n) => s + n, 0), 10);
  assert.equal(me.packs.available, 0);

  tick(RULES.free.interval);
  assert.equal((await a("POST", "/api/packs/open")).status, 200);
  assert.equal((await a("POST", "/api/packs/open")).status, 429);
});

test("packState spaart niet boven het maximum", () => {
  const s = packState({ pack_credits: 0, credits_at: 0, premium_until: 0 }, 100 * HOUR);
  assert.equal(s.credits, RULES.free.max);
  assert.equal(s.nextAt, null);
});

test("ruilen: alleen dubbelen, zelfde zeldzaamheid, en atomisch", async () => {
  const { db, client } = setup();
  const a = client();
  const b = client();
  await register(a, "anna");
  await register(b, "bram");
  const [x, y, z] = BY_RARITY.goud;
  const zilver = BY_RARITY.zilver[0];
  await give(db, "anna", x.id, 2);
  await give(db, "bram", y.id, 2);
  await give(db, "bram", zilver.id, 2);

  assert.equal((await a("POST", "/api/trades", { to: "bram", give: x.id, want: zilver.id })).status, 400); // andere zeldzaamheid
  assert.equal((await a("POST", "/api/trades", { to: "bram", give: x.id, want: z.id })).status, 400); // bram heeft z niet dubbel
  assert.equal((await a("POST", "/api/trades", { to: "anna", give: x.id, want: y.id })).status, 400); // met jezelf

  const { body } = await a("POST", "/api/trades", { to: "bram", give: x.id, want: y.id });
  assert.equal((await a("POST", `/api/trades/${body.id}/accept`)).status, 404); // alleen ontvanger
  assert.equal((await b("POST", `/api/trades/${body.id}/accept`)).status, 200);
  assert.equal((await b("POST", `/api/trades/${body.id}/accept`)).status, 404); // niet twee keer

  const annaCol = (await a("GET", "/api/me")).body.collection;
  const bramCol = (await b("GET", "/api/me")).body.collection;
  assert.deepEqual([annaCol[x.id], annaCol[y.id]], [1, 1]);
  assert.deepEqual([bramCol[y.id], bramCol[x.id]], [1, 1]);
});

test("ruil mislukt als een kaart intussen niet meer dubbel is", async () => {
  const { db, client } = setup();
  const a = client();
  const b = client();
  await register(a, "anna");
  await register(b, "bram");
  const [x, y] = BY_RARITY.brons;
  await give(db, "anna", x.id, 2);
  await give(db, "bram", y.id, 2);
  const { body } = await a("POST", "/api/trades", { to: "bram", give: x.id, want: y.id });
  await give(db, "anna", x.id, 1);
  assert.equal((await b("POST", `/api/trades/${body.id}/accept`)).status, 409);
  assert.equal((await b("GET", "/api/me")).body.collection[y.id], 2);
});

test("seizoenspas via Mollie: pas actief na 'paid', extra pakjes", async () => {
  const payments = new Map();
  const mollie = {
    async createPayment(body) {
      const id = `tr_${payments.size + 1}`;
      payments.set(id, { id, status: "open", ...body });
      return { id, _links: { checkout: { href: `https://www.mollie.com/checkout/${id}` } } };
    },
    async getPayment(id) {
      return payments.get(id);
    },
  };
  const { client } = setup({ mollie });
  const a = client();
  await register(a, "kim");
  const { body } = await a("POST", "/api/pass/checkout");
  assert.match(body.url, /mollie\.com\/checkout\/tr_1/);
  assert.deepEqual(payments.get("tr_1").amount, { currency: "EUR", value: "4.99" });
  assert.equal((await a("POST", "/api/pass/verify")).body.premiumUntil, null);

  payments.get("tr_1").status = "paid";
  await a("POST", "/api/mollie/webhook", "id=tr_1", { "Content-Type": "application/x-www-form-urlencoded" });
  await a("POST", "/api/mollie/webhook", "id=tr_1", { "Content-Type": "application/x-www-form-urlencoded" }); // dubbel = geen extra dagen
  const me = (await a("GET", "/api/me")).body;
  assert.ok(me.premiumUntil);
  assert.equal(me.premiumUntil - (await a("GET", "/api/me")).body.premiumUntil, 0);
  assert.equal(me.packs.max, RULES.premium.max);
});

test("Oerkristal: genummerd, maximaal KRISTAL_CAP per dino, daarna Prisma", async () => {
  // random() = bijna 0 → steeds Legendarisch, eerste kaart, Oerkristal
  const { client, tick } = setup({ random: () => 0.00001 });
  const a = client();
  await register(a, "geluk");
  const serials = [];
  const keys = [];
  for (let i = 0; i < 6; i++) {
    const { body } = await a("POST", "/api/packs/open");
    for (const c of body.cards) (keys.push(c.key), c.serial && serials.push(c.serial));
    tick(RULES.free.interval);
  }
  assert.deepEqual(serials, Array.from({ length: KRISTAL_CAP }, (_, i) => i + 1));
  assert.equal(keys.filter((k) => k.endsWith(":prisma")).length, 30 - KRISTAL_CAP);
  const me = (await a("GET", "/api/me")).body;
  assert.equal(me.prints.length, KRISTAL_CAP);
  assert.ok(me.value > 0);
  assert.equal((await a("GET", "/api/kristal")).body.found[parseKey(keys[0]).card.id], KRISTAL_CAP);
});

test("kluiskaarten zijn niet ruilbaar; holo alleen tegen holo", async () => {
  const { db, client } = setup();
  const a = client();
  const b = client();
  await register(a, "anna");
  await register(b, "bram");
  const [x, y] = BY_RARITY.zilver;
  await give(db, "anna", `${x.id}:prisma`, 3);
  await give(db, "bram", `${y.id}:prisma`, 3);
  assert.equal((await a("POST", "/api/trades", { to: "bram", give: `${x.id}:prisma`, want: `${y.id}:prisma` })).status, 400);
  await give(db, "anna", `${x.id}:holo`, 2);
  await give(db, "bram", y.id, 2);
  assert.equal((await a("POST", "/api/trades", { to: "bram", give: `${x.id}:holo`, want: y.id })).status, 400);
  await give(db, "bram", `${y.id}:holo`, 2);
  const { status, body } = await a("POST", "/api/trades", { to: "bram", give: `${x.id}:holo`, want: `${y.id}:holo` });
  assert.equal(status, 201);
  assert.equal((await b("POST", `/api/trades/${body.id}/accept`)).status, 200);
  assert.equal((await a("GET", "/api/me")).body.collection[`${y.id}:holo`], 1);
});

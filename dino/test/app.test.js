import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp, RULES, packState } from "../src/app.js";
import { CARDS, BY_RARITY, drawPack, PACK_SIZE, parseKey, KRISTAL_CAP, pointsOf } from "../src/cards.js";
import { testDb, testPgDb } from "./d1.js";

const makeDb = process.env.DB === "pg" ? testPgDb : testDb;

const BASE = "https://dinorijk.example";
const HOUR = 3600 * 1000;

function setup({ mollie = null, random } = {}) {
  const db = makeDb();
  let clock = Date.UTC(2026, 10, 1);
  const mails = [];
  const mailer = { configured: true, send: async (m) => mails.push(m) };
  const app = createApp({ db, mollie, mailer, now: () => clock, ...(random ? { random } : {}) });
  const client = () => {
    let cookie = "";
    const ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`; // elke testclient een eigen netwerk
    const call = async (method, path, body, headers = {}) => {
      const res = await app(
        new Request(BASE + path, {
          method,
          headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), Cookie: cookie, "x-nf-client-connection-ip": ip, ...headers },
          body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        })
      );
      const set = res.headers.get("Set-Cookie");
      if (set) cookie = set.split(";")[0];
      return { status: res.status, body: res.headers.get("Content-Type")?.includes("json") ? await res.json() : await res.text() };
    };
    return call;
  };
  return { db, client, mails, tick: (ms) => (clock += ms), now: () => clock };
}

async function register(call, username) {
  const r = await call("POST", "/api/register", { username, email: `${username}@test.nl`, password: "geheim123", adult: true });
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
  assert.equal((await a("POST", "/api/register", { username: "jan", email: "jan@test.nl", password: "geheim123" })).status, 400);
  await register(a, "jan");
  assert.equal((await client()("POST", "/api/register", { username: "JAN", email: "jan@test.nl", password: "geheim123", adult: true })).status, 409);
  const b = client();
  assert.equal((await b("POST", "/api/login", { username: "jan", password: "fout-fout" })).status, 401);
  assert.equal((await b("POST", "/api/login", { username: "jan", email: "jan@test.nl", password: "geheim123" })).status, 200);
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
const webhook = (call, id) => call("POST", "/api/mollie/webhook", `id=${id}`, { "Content-Type": "application/x-www-form-urlencoded" });

test("eieren kopen via Mollie: pas na 'paid', één keer geleverd, gratis eieren eerst", async () => {
  const mollie = fakeMollie();
  const { client } = setup({ mollie });
  const a = client();
  await register(a, "kim");
  const { body } = await a("POST", "/api/checkout", { product: "eieren5" });
  assert.match(body.url, /mollie\.com\/checkout\/tr_1/);
  assert.deepEqual(mollie.payments.get("tr_1").amount, { currency: "EUR", value: "3.99" });
  assert.equal((await a("GET", "/api/me")).body.packs.bought, 0);

  mollie.payments.get("tr_1").status = "paid";
  await webhook(a, "tr_1");
  await webhook(a, "tr_1"); // dubbele melding levert niet nog eens
  assert.equal((await a("GET", "/api/me")).body.packs.bought, 5);

  for (let i = 0; i < 7; i++) assert.equal((await a("POST", "/api/packs/open")).status, 200);
  const me = (await a("GET", "/api/me")).body;
  assert.deepEqual([me.packs.available, me.packs.bought], [0, 0]);
  assert.equal((await a("POST", "/api/packs/open")).status, 429);
});

test("seizoenspas via Mollie geeft snellere gratis eieren", async () => {
  const mollie = fakeMollie();
  const { client } = setup({ mollie });
  const a = client();
  await register(a, "pas");
  await a("POST", "/api/checkout", { product: "pass" });
  mollie.payments.get("tr_1").status = "paid";
  await a("POST", "/api/checkout/verify", {});
  const me = (await a("GET", "/api/me")).body;
  assert.ok(me.premiumUntil);
  assert.equal(me.packs.max, RULES.premium.max);
});

test("uitgavegrens van €100 per 30 dagen", async () => {
  const { client, tick } = setup();
  const a = client();
  await register(a, "grens");
  for (let i = 0; i < 5; i++) assert.equal((await a("POST", "/api/checkout", { product: "eieren30" })).status, 200); // 5 × 17,99
  assert.equal((await a("POST", "/api/checkout", { product: "eieren30" })).status, 429);
  assert.equal((await a("POST", "/api/checkout", { product: "eieren5" })).status, 200); // 89,95 + 3,99 past nog
  tick(31 * 24 * HOUR);
  await a("POST", "/api/login", { username: "grens", email: "grens@test.nl", password: "geheim123" }); // sessie was verlopen
  assert.equal((await a("POST", "/api/checkout", { product: "eieren30" })).status, 200);
});

test("verstenen en maken: fossielen, geen Oerkristal, geen eieren van fossielen", async () => {
  const { db, client } = setup();
  const a = client();
  await register(a, "fossiel");
  const [x, y] = BY_RARITY.zilver;
  await give(db, "fossiel", x.id, 3);
  await give(db, "fossiel", `${x.id}:holo`, 2);
  await give(db, "fossiel", `${y.id}:kristal`, 1);

  assert.equal((await a("POST", "/api/fossils/dust", { key: `${y.id}:kristal` })).status, 400);
  assert.equal((await a("POST", "/api/fossils/dust", { key: x.id, count: 4 })).status, 400);
  assert.equal((await a("POST", "/api/fossils/dust", { key: x.id, count: 1 })).body.gained, 20);
  assert.equal((await a("POST", "/api/fossils/dust-dupes", {})).body.gained, 20 + 80); // 1 normaal + 1 holo
  let me = (await a("GET", "/api/me")).body;
  assert.equal(me.fossils, 120);
  assert.deepEqual([me.collection[x.id], me.collection[`${x.id}:holo`], me.collection[`${y.id}:kristal`]], [1, 1, 1]);

  assert.equal((await a("POST", "/api/fossils/dust", { key: x.id, count: 1 })).status, 200); // laatste mag ook
  assert.equal((await a("GET", "/api/me")).body.collection[x.id], undefined);

  assert.equal((await a("POST", "/api/fossils/craft", { key: `${y.id}:prisma` })).status, 400);
  assert.equal((await a("POST", "/api/fossils/craft", { key: `${y.id}:holo` })).status, 400); // 400 nodig, 140 in bezit
  assert.equal((await a("POST", "/api/fossils/craft", { key: y.id })).status, 200); // 100
  me = (await a("GET", "/api/me")).body;
  assert.equal(me.fossils, 40);
  assert.equal(me.collection[y.id], 1);

  // Er bestaat geen manier om fossielen in te wisselen voor eieren, of om te ruilen.
  for (const path of ["/api/fossils/buy-eggs", "/api/trades"]) assert.equal((await a("POST", path, {})).status, 404);
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

test("accounts: maximaal 3 per netwerk per dag, bots met het verborgen veld geweigerd", async () => {
  const { client, tick } = setup();
  const sameNet = { "x-nf-client-connection-ip": "203.0.113.7" };
  const reg = (name, extra = {}) => client()("POST", "/api/register", { username: name, email: `${name}@test.nl`, password: "geheim123", adult: true, ...extra }, sameNet);
  assert.equal((await reg("bot1", { website: "http://spam.example" })).status, 400);
  for (const n of ["een", "twee", "drie"]) assert.equal((await reg(n)).status, 201);
  const vierde = await reg("vier");
  assert.equal(vierde.status, 429);
  assert.match(vierde.body.error, /dit netwerk/);
  // Ander netwerk mag wel
  assert.equal((await client()("POST", "/api/register", { username: "anders", email: "anders@test.nl", password: "geheim123", adult: true }, { "x-nf-client-connection-ip": "198.51.100.9" })).status, 201);
  // Na 24 uur weer ruimte
  tick(24 * HOUR + 1);
  assert.equal((await reg("vier")).status, 201);
});

test("accounts: maximum per uur voor de hele site", async () => {
  const { client } = setup();
  for (let i = 0; i < RULES.accountsPerHourTotal; i++) {
    const r = await client()("POST", "/api/register", { username: `speler${i}`, email: `speler${i}@test.nl`, password: "geheim123", adult: true }, { "x-nf-client-connection-ip": `192.0.2.${i}` });
    assert.equal(r.status, 201, `account ${i}`);
  }
  const r = await client()("POST", "/api/register", { username: "teveel", email: "teveel@test.nl", password: "geheim123", adult: true }, { "x-nf-client-connection-ip": "192.0.2.250" });
  assert.equal(r.status, 429);
});

test("e-mail: verplicht en uniek, inloggen met e-mail of gebruikersnaam", async () => {
  const { client } = setup();
  const a = client();
  assert.equal((await a("POST", "/api/register", { username: "zonder", password: "geheim123", adult: true })).status, 400);
  assert.equal((await a("POST", "/api/register", { username: "eva", email: " Eva@Voorbeeld.NL ", password: "geheim123", adult: true })).status, 201);
  assert.equal((await client()("POST", "/api/register", { username: "eva2", email: "eva@voorbeeld.nl", password: "geheim123", adult: true })).status, 409);
  assert.equal((await client()("POST", "/api/login", { login: "EVA@voorbeeld.nl", password: "geheim123" })).status, 200);
  assert.equal((await client()("POST", "/api/login", { login: "eva", password: "geheim123" })).status, 200);
  assert.equal((await client()("POST", "/api/login", { login: "eva@voorbeeld.nl", password: "fout-fout" })).status, 401);
  assert.equal((await a("GET", "/api/me")).body.email, "eva@voorbeeld.nl");
});

test("wachtwoord vergeten: mail met link, eenmalig, verloopt, logt overal uit", async () => {
  const { client, mails, tick } = setup();
  const a = client();
  await register(a, "vergeet");
  // Onbekend adres: zelfde antwoord, geen mail
  assert.equal((await client()("POST", "/api/password/forgot", { email: "bestaat@niet.nl" })).status, 200);
  assert.equal(mails.length, 0);
  await client()("POST", "/api/password/forgot", { email: "vergeet@test.nl" });
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "vergeet@test.nl");
  const token = mails[0].text.match(/token=([0-9a-f]+)/)[1];

  const b = client();
  assert.equal((await b("POST", "/api/password/reset", { token, password: "kort" })).status, 400);
  assert.equal((await b("POST", "/api/password/reset", { token, password: "nieuwwachtwoord" })).status, 200);
  assert.equal((await b("GET", "/api/me")).body.username, "vergeet"); // meteen ingelogd
  assert.equal((await a("GET", "/api/me")).status, 401); // oude sessie uitgelogd
  assert.equal((await client()("POST", "/api/password/reset", { token, password: "nogeenkeer1" })).status, 400); // eenmalig
  assert.equal((await client()("POST", "/api/login", { login: "vergeet", password: "nieuwwachtwoord" })).status, 200);

  // Verlopen link
  await client()("POST", "/api/password/forgot", { email: "vergeet@test.nl" });
  const token2 = mails[1].text.match(/token=([0-9a-f]+)/)[1];
  tick(61 * 60 * 1000);
  assert.equal((await client()("POST", "/api/password/reset", { token: token2, password: "nieuwwachtwoord2" })).status, 400);

  // Maximaal 3 aanvragen per uur
  for (let i = 0; i < 5; i++) await client()("POST", "/api/password/forgot", { email: "vergeet@test.nl" });
  assert.equal(mails.length, 2 + 3);
});

test("bestaand account kan e-mail toevoegen (met wachtwoord)", async () => {
  const { db, client } = setup();
  const a = client();
  await register(a, "oud");
  await db.prepare("UPDATE users SET email = NULL WHERE username = ?").bind("oud").run();
  assert.equal((await a("POST", "/api/account/email", { email: "oud@nieuw.nl", password: "fout-fout" })).status, 401);
  assert.equal((await a("POST", "/api/account/email", { email: "oud@nieuw.nl", password: "geheim123" })).status, 200);
  assert.equal((await a("GET", "/api/me")).body.email, "oud@nieuw.nl");
});

test("ranglijst: hoogste verzamelwaarde bovenaan, eigen plek erbij", async () => {
  const { db, client } = setup();
  const [a, b, c] = [client(), client(), client()];
  await register(a, "klein");
  await register(b, "groot");
  await register(c, "midden");
  await give(db, "klein", BY_RARITY.brons[0].id, 1); // 1 punt
  await give(db, "groot", `${BY_RARITY.icoon[0].id}:holo`, 1); // 40 × 3 = 120
  await give(db, "midden", BY_RARITY.goud[0].id, 2); // 2 × 10 = 20
  for (const x of [a, b, c]) await x("GET", "/api/me"); // score bijwerken
  const { body } = await a("GET", "/api/leaderboard");
  assert.deepEqual(body.top.map((r) => [r.rank, r.username, r.score]), [[1, "groot", 120], [2, "midden", 20], [3, "klein", 1]]);
  assert.deepEqual(body.mine, { username: "klein", score: 1, rank: 3 });

  // Ei openen en verstenen houden de score bij zonder /api/me
  const before = (await c("GET", "/api/leaderboard")).body.mine.score;
  await c("POST", "/api/fossils/dust", { key: BY_RARITY.goud[0].id, count: 1 });
  assert.equal((await c("GET", "/api/leaderboard")).body.mine.score, before - 10);
  const { body: opened } = await c("POST", "/api/packs/open");
  const gained = opened.cards.reduce((n, k) => n + pointsOf(k.key), 0);
  assert.equal((await c("GET", "/api/leaderboard")).body.mine.score, before - 10 + gained);
});

test("gelijktijdig: bestedingslimiet, registraties per netwerk en dezelfde naam houden stand", async () => {
  const { client } = setup();
  const a = client();
  await register(a, "haast");
  const buys = await Promise.all(Array.from({ length: 12 }, () => a("POST", "/api/checkout", { product: "eieren30" })));
  assert.equal(buys.filter((r) => r.status === 200).length, 5); // 5 × 17,99 past onder €100
  assert.equal((await a("GET", "/api/me")).body.packs.bought, 150);

  const ip = { "x-nf-client-connection-ip": "198.51.100.7" };
  const regs = await Promise.all(Array.from({ length: 8 }, (_, i) => client()("POST", "/api/register", { username: `snel${i}`, email: `snel${i}@test.nl`, password: "geheim123", adult: true }, ip)));
  assert.equal(regs.filter((r) => r.status === 201).length, RULES.accountsPerIpPerDay);

  const same = await Promise.all(Array.from({ length: 4 }, (_, i) => client()("POST", "/api/register", { username: "dubbel", email: `dubbel${i}@test.nl`, password: "geheim123", adult: true })));
  assert.deepEqual(same.map((r) => r.status).sort(), [201, 409, 409, 409]);
});

test("rare invoer geeft nette 4xx in plaats van een serverfout", async () => {
  const { client } = setup();
  const a = client();
  await register(a, "raar");
  const cases = [
    ["/api/login", "null"], ["/api/register", "[1,2]"], ["/api/checkout", { product: "constructor" }], ["/api/checkout", { product: "__proto__" }],
    ["/api/fossils/craft", { key: "vuur-1:constructor" }], ["/api/fossils/dust", { key: ["vuur-1"] }], ["/api/fossils/dust", { key: "vuur-1", count: 1.5 }],
    ["/api/login", { login: ["a"], password: {} }], ["/api/account/email", { email: ["a@b.nl"] }],
  ];
  for (const [path, body] of cases) {
    const r = await a("POST", path, body);
    assert.ok(r.status >= 400 && r.status < 500, `${path} ${JSON.stringify(body)} → ${r.status}`);
  }
  // text/plain kan een andere website ongevraagd sturen: dat telt niet als JSON.
  const r = await client()("POST", "/api/register", JSON.stringify({ username: "csrf", email: "csrf@test.nl", password: "geheim123", adult: true }), { "Content-Type": "text/plain; application/json" });
  assert.equal(r.status, 400);
});

test("wachtwoord raden wordt na 10 pogingen per kwartier afgeremd", async () => {
  const { client, tick } = setup();
  await register(client(), "slot");
  const b = client();
  for (let i = 0; i < RULES.loginFailsPerAccount; i++) assert.equal((await b("POST", "/api/login", { login: "slot", password: `fout${i}xxx` })).status, 401);
  assert.equal((await b("POST", "/api/login", { login: "slot", password: "geheim123" })).status, 429);
  tick(16 * 60 * 1000);
  assert.equal((await b("POST", "/api/login", { login: "SLOT", password: "geheim123" })).status, 200);
});

test("Mollie: mislukte aanvraag geeft limiet terug, webhook vindt reservering, 2× pas = 60 dagen", async () => {
  const mollie = fakeMollie();
  const { client, db } = setup({ mollie });
  const a = client();
  await register(a, "mol");
  const create = mollie.createPayment;
  mollie.createPayment = async () => { throw new Error("Mollie 503"); };
  assert.equal((await a("POST", "/api/checkout", { product: "eieren30" })).status, 500);
  assert.equal((await a("GET", "/api/me")).body.spendLeft, RULES.spendCap30d); // reservering is weer vrijgegeven
  mollie.createPayment = create;

  // Twee passen tegelijk betaald: allebei geleverd.
  await Promise.all([a("POST", "/api/checkout", { product: "pass" }), a("POST", "/api/checkout", { product: "pass" })]);
  for (const p of mollie.payments.values()) p.status = "paid";
  await Promise.all([webhook(a, "tr_1"), webhook(a, "tr_2"), a("POST", "/api/checkout/verify", {})]);
  const days = ((await a("GET", "/api/me")).body.premiumUntil - (await db.prepare("SELECT MIN(created_at) AS t FROM payments").first()).t) / (24 * HOUR);
  assert.equal(Math.round(days), 60);

  // Mollie-id niet opgeslagen (bijv. time-out na het aanmaken): de webhook koppelt hem alsnog via de metadata.
  await a("POST", "/api/checkout", { product: "eieren5" });
  await db.prepare("UPDATE payments SET id = ?, status = 'reserving' WHERE id = 'tr_3'").bind(mollie.payments.get("tr_3").metadata.ref).run();
  mollie.payments.get("tr_3").status = "paid";
  await webhook(a, "tr_3");
  assert.equal((await a("GET", "/api/me")).body.packs.bought, 5);

  // Betaald maar van iemand anders: niet geleverd en ook niet op 'paid' gezet.
  const b = client();
  await register(b, "ander");
  await b("POST", "/api/checkout", { product: "eieren5" });
  mollie.payments.get("tr_4").status = "paid";
  mollie.payments.get("tr_4").metadata.userId = "iemand-anders";
  await webhook(b, "tr_4");
  assert.equal((await b("GET", "/api/me")).body.packs.bought, 0);
  assert.notEqual((await db.prepare("SELECT status FROM payments WHERE id = 'tr_4'").first()).status, "paid");
});

test("wachtwoord reset maakt andere resetlinks ongeldig", async () => {
  const { client, mails } = setup();
  const a = client();
  await register(a, "twee");
  await a("POST", "/api/password/forgot", { email: "twee@test.nl" });
  await a("POST", "/api/password/forgot", { email: "twee@test.nl" });
  const [t1, t2] = mails.map((m) => m.text.match(/token=([a-f0-9]+)/)[1]);
  assert.equal((await a("POST", "/api/password/reset", { token: t2, password: "nieuwwachtwoord" })).status, 200);
  assert.equal((await a("POST", "/api/password/reset", { token: t1, password: "hackerwachtwoord" })).status, 400);
});

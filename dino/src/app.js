import { CARDS, GROUPS, GAME_NAME, TYPES, PUBLISHED_ODDS, RARITIES, SEASON, VARIANTS, KRISTAL_CAP, RARITY_POINTS, FOSSILS, drawPack, cryptoRandom, keyOf, parseKey, pointsOf, dustValue, craftCost } from "./cards.js";
import { hashPassword, randomHex, verifyPassword } from "./auth.js";
import { centsToMollie } from "./mollie.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const RULES = {
  free: { interval: 12 * HOUR, max: 2 },
  premium: { interval: 6 * HOUR, max: 4 },
  sessionDays: 30,
  // Bescherming: maximaal zoveel uitgeven per 30 dagen (in centen).
  spendCap30d: 10000,
};

// Wat je kunt kopen. Eieren zijn het enige wat je met geld koopt; fossielen kun je nooit kopen of inwisselen voor eieren.
export const PRODUCTS = {
  eieren5: { label: "5 eieren", price: 399, eggs: 5 },
  eieren12: { label: "12 eieren", price: 799, eggs: 12, tag: "Meest gekozen" },
  eieren30: { label: "30 eieren", price: 1799, eggs: 30, tag: "Beste prijs per ei" },
  pass: { label: "Seizoenspas (30 dagen)", price: 499, days: 30 },
};

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
const fail = (status, error) => json({ error }, status);

// Gratis eieren laden vanzelf op: 1 per interval, tot het maximum.
export function packState(user, now) {
  const premium = user.premium_until > now;
  const { interval, max } = premium ? RULES.premium : RULES.free;
  let credits = user.pack_credits;
  let at = user.credits_at;
  if (credits < max) {
    const gained = Math.floor((now - at) / interval);
    credits = Math.min(max, credits + gained);
    at = credits >= max ? now : at + gained * interval;
  } else at = now;
  return { credits, at, max, premium, nextAt: credits >= max ? null : at + interval };
}

function readCookie(req, name) {
  const match = (req.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export function createApp({ db, mollie, now = () => Date.now(), random = cryptoRandom }) {
  const demoMode = !mollie;

  const one = (sql, ...args) => db.prepare(sql).bind(...args).first();
  const all = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
  const run = (sql, ...args) => db.prepare(sql).bind(...args).run();
  const addCard = (userId, key) =>
    db.prepare("INSERT INTO collection (user_id, card_id, count) VALUES (?, ?, 1) ON CONFLICT (user_id, card_id) DO UPDATE SET count = collection.count + 1").bind(userId, key);

  async function currentUser(req) {
    const token = readCookie(req, "sid");
    if (!token) return null;
    return one("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?", token, now());
  }

  async function startSession(req, userId) {
    const token = randomHex();
    await run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, now() + RULES.sessionDays * DAY);
    const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
    return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${RULES.sessionDays * 86400}${secure}`;
  }

  async function spentLast30d(userId) {
    const row = await one("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE user_id = ? AND status IN ('paid', 'open', 'pending', 'authorized') AND created_at > ?", userId, now() - 30 * DAY);
    return row.total;
  }

  // Levert een betaald product precies één keer.
  async function fulfil(paymentId) {
    const marked = await run("UPDATE payments SET status = 'paid' WHERE id = ? AND status != 'paid'", paymentId);
    if (marked.meta.changes !== 1) return;
    const pay = await one("SELECT user_id, product FROM payments WHERE id = ?", paymentId);
    const product = PRODUCTS[pay.product];
    if (product.eggs) {
      await run("UPDATE users SET bought_eggs = bought_eggs + ? WHERE id = ?", product.eggs, pay.user_id);
    } else {
      const user = await one("SELECT premium_until FROM users WHERE id = ?", pay.user_id);
      await run("UPDATE users SET premium_until = ? WHERE id = ?", Math.max(now(), user.premium_until) + product.days * DAY, pay.user_id);
    }
  }

  async function checkMolliePayment(paymentId) {
    const row = await one("SELECT * FROM payments WHERE id = ?", paymentId);
    if (!row || row.status === "paid") return;
    const payment = await mollie.getPayment(paymentId);
    if (payment.status === "paid" && payment.metadata?.userId === row.user_id) await fulfil(paymentId);
    else if (payment.status !== row.status) await run("UPDATE payments SET status = ? WHERE id = ? AND status != 'paid'", payment.status, paymentId);
  }

  // Haal `n` exemplaren van een kaart weg; verwijdert de rij als er 0 overblijven. Geeft true als het lukte.
  async function takeCards(userId, key, n, expectedCount) {
    const res =
      n === expectedCount
        ? await run("DELETE FROM collection WHERE user_id = ? AND card_id = ? AND count = ?", userId, key, expectedCount)
        : await run("UPDATE collection SET count = count - ? WHERE user_id = ? AND card_id = ? AND count = ?", n, userId, key, expectedCount);
    return res.meta.changes === 1;
  }

  const publicRoutes = {
    "GET /api/catalog": async () =>
      json({
        game: GAME_NAME,
        season: SEASON,
        groups: GROUPS.map(({ id, name, colors, title }) => ({ id, name, colors, title })),
        types: TYPES,
        rarities: RARITIES,
        variants: VARIANTS,
        kristalCap: KRISTAL_CAP,
        rarityPoints: RARITY_POINTS,
        fossils: FOSSILS,
        cards: CARDS,
        odds: PUBLISHED_ODDS,
        rules: RULES,
        products: PRODUCTS,
        demoMode,
      }),

    "POST /api/register": async (req, body) => {
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return fail(400, "Gebruikersnaam: 3–20 letters, cijfers of _.");
      if (password.length < 8) return fail(400, "Wachtwoord moet minstens 8 tekens zijn.");
      if (body.adult !== true) return fail(400, "Je moet 18 jaar of ouder zijn.");
      if (await one("SELECT 1 FROM users WHERE lower(username) = lower(?)", username)) return fail(409, "Die gebruikersnaam is al bezet.");
      const { hash, salt } = await hashPassword(password);
      const id = crypto.randomUUID();
      await run(
        "INSERT INTO users (id, username, pass_hash, pass_salt, created_at, pack_credits, credits_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, username, hash, salt, new Date(now()).toISOString(), RULES.free.max, now()
      );
      return json({ ok: true }, 201, { "Set-Cookie": await startSession(req, id) });
    },

    "POST /api/login": async (req, body) => {
      const user = await one("SELECT * FROM users WHERE lower(username) = lower(?)", String(body.username || "").trim());
      if (!user || !(await verifyPassword(String(body.password || ""), user.pass_salt, user.pass_hash))) {
        return fail(401, "Gebruikersnaam of wachtwoord klopt niet.");
      }
      return json({ ok: true }, 200, { "Set-Cookie": await startSession(req, user.id) });
    },

    "POST /api/logout": async (req) => {
      const token = readCookie(req, "sid");
      if (token) await run("DELETE FROM sessions WHERE token = ?", token);
      return json({ ok: true }, 200, { "Set-Cookie": "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
    },

    "GET /api/kristal": async () => {
      const rows = await all("SELECT card_id, COUNT(*) AS n FROM prints GROUP BY card_id");
      return json({ cap: KRISTAL_CAP, found: Object.fromEntries(rows.map((r) => [r.card_id, r.n])) });
    },

    // Mollie stuurt alleen het betaling-id; de status halen we zelf op.
    "POST /api/mollie/webhook": async (req) => {
      if (!mollie) return new Response("ok");
      const form = await req.formData().catch(() => null);
      const id = form?.get("id");
      if (id) await checkMolliePayment(String(id));
      return new Response("ok");
    },
  };

  const userRoutes = {
    "GET /api/me": async (_req, _body, user) => {
      const pack = packState(user, now());
      const rows = await all("SELECT card_id, count FROM collection WHERE user_id = ?", user.id);
      const prints = await all("SELECT card_id, serial FROM prints WHERE user_id = ? ORDER BY created_at", user.id);
      const spent = await spentLast30d(user.id);
      return json({
        username: user.username,
        packs: { available: pack.credits, max: pack.max, nextAt: pack.nextAt, bought: user.bought_eggs },
        premiumUntil: user.premium_until > now() ? user.premium_until : null,
        packsOpened: user.packs_opened,
        fossils: user.fossils,
        collection: Object.fromEntries(rows.map((r) => [r.card_id, r.count])),
        prints: prints.map((p) => ({ cardId: p.card_id, serial: p.serial })),
        value: rows.reduce((sum, r) => sum + pointsOf(r.card_id) * r.count, 0),
        spendLeft: Math.max(0, RULES.spendCap30d - spent),
      });
    },

    // Gratis eieren gaan eerst; daarna de gekochte.
    "POST /api/packs/open": async (_req, _body, user) => {
      const pack = packState(user, now());
      let res;
      if (pack.credits >= 1) {
        const nextAt = pack.credits >= pack.max ? now() : pack.at;
        // Optimistisch slot: lukt alleen als niemand tegelijk een ei opende.
        res = await run(
          "UPDATE users SET pack_credits = ?, credits_at = ?, packs_opened = packs_opened + 1 WHERE id = ? AND pack_credits = ? AND credits_at = ?",
          pack.credits - 1, nextAt, user.id, user.pack_credits, user.credits_at
        );
      } else if (user.bought_eggs >= 1) {
        res = await run("UPDATE users SET bought_eggs = bought_eggs - 1, packs_opened = packs_opened + 1 WHERE id = ? AND bought_eggs >= 1", user.id);
      } else return fail(429, "Je hebt nu geen ei. Kom straks terug!");
      if (res.meta.changes !== 1) return fail(409, "Probeer het nog eens.");

      const cards = [];
      for (const key of drawPack(random)) {
        const { card, variant } = parseKey(key);
        if (variant !== "kristal") {
          cards.push({ key });
          continue;
        }
        // Volgend serienummer, maar alleen als de oplage nog niet op is (in één statement).
        // Pakken twee spelers tegelijk hetzelfde nummer, dan faalt er één op de primary key: die krijgt Prisma.
        const ins = await run(
          `INSERT INTO prints (card_id, serial, user_id, created_at)
           SELECT CAST(? AS TEXT), COALESCE(MAX(serial), 0) + 1, CAST(? AS TEXT), CAST(? AS BIGINT) FROM prints WHERE card_id = ? HAVING COALESCE(MAX(serial), 0) < ?`,
          card.id, user.id, now(), card.id, KRISTAL_CAP
        ).catch(() => ({ meta: { changes: 0 } }));
        if (ins.meta.changes === 1) {
          const { serial } = await one("SELECT MAX(serial) AS serial FROM prints WHERE card_id = ? AND user_id = ?", card.id, user.id);
          cards.push({ key, serial });
        } else cards.push({ key: keyOf(card.id, "prisma") }); // uitverkocht: wordt Prisma
      }
      await db.batch(cards.map(({ key }) => addCard(user.id, key)));
      return json({ cards });
    },

    // Versteen kaarten tot fossielen.
    "POST /api/fossils/dust": async (_req, body, user) => {
      const parsed = parseKey(String(body.key || ""));
      if (!parsed) return fail(400, "Onbekende kaart.");
      const per = dustValue(parsed.card, parsed.variant);
      if (per == null) return fail(400, "Oerkristal-kaarten zijn genummerd en kun je niet verstenen.");
      const n = Math.floor(Number(body.count) || 1);
      const owned = (await one("SELECT count FROM collection WHERE user_id = ? AND card_id = ?", user.id, body.key))?.count || 0;
      if (n < 1 || n > owned) return fail(400, "Zoveel heb je er niet.");
      if (!(await takeCards(user.id, body.key, n, owned))) return fail(409, "Probeer het nog eens.");
      await run("UPDATE users SET fossils = fossils + ? WHERE id = ?", per * n, user.id);
      return json({ gained: per * n });
    },

    // Versteen alle dubbele kaarten in één keer (je houdt van elke versie er één).
    "POST /api/fossils/dust-dupes": async (_req, _body, user) => {
      const rows = await all("SELECT card_id, count FROM collection WHERE user_id = ? AND count > 1", user.id);
      let gained = 0;
      for (const r of rows) {
        const p = parseKey(r.card_id);
        const per = p && dustValue(p.card, p.variant);
        if (per == null) continue;
        if (await takeCards(user.id, r.card_id, r.count - 1, r.count)) gained += per * (r.count - 1);
      }
      if (gained) await run("UPDATE users SET fossils = fossils + ? WHERE id = ?", gained, user.id);
      return json({ gained });
    },

    // Maak een dino naar keuze van fossielen (alleen Normaal of Holo).
    "POST /api/fossils/craft": async (_req, body, user) => {
      const parsed = parseKey(String(body.key || ""));
      if (!parsed) return fail(400, "Onbekende kaart.");
      const cost = craftCost(parsed.card, parsed.variant);
      if (cost == null) return fail(400, "Goudfolie, Prisma en Oerkristal vind je alleen in eieren.");
      const res = await run("UPDATE users SET fossils = fossils - ? WHERE id = ? AND fossils >= ?", cost, user.id, cost);
      if (res.meta.changes !== 1) return fail(400, `Je hebt ${cost} fossielen nodig.`);
      await addCard(user.id, keyOf(parsed.card.id, parsed.variant)).run();
      return json({ ok: true, cost });
    },

    "POST /api/checkout": async (req, body, user) => {
      const productId = String(body.product || "");
      const product = PRODUCTS[productId];
      if (!product) return fail(400, "Onbekend product.");
      if ((await spentLast30d(user.id)) + product.price > RULES.spendCap30d) {
        return fail(429, `Je zit aan je limiet van €${RULES.spendCap30d / 100} per 30 dagen. Dat is er om je te beschermen.`);
      }
      if (demoMode) {
        const id = `demo_${randomHex(8)}`;
        await run("INSERT INTO payments (id, user_id, product, amount, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)", id, user.id, productId, product.price, now());
        await fulfil(id);
        return json({ url: "/#/winkel?betaald=1" });
      }
      const origin = new URL(req.url).origin;
      const payment = await mollie.createPayment({
        amount: { currency: "EUR", value: centsToMollie(product.price) },
        description: `${GAME_NAME} – ${product.label}`,
        redirectUrl: `${origin}/#/winkel?betaald=1`,
        ...(origin.startsWith("https://") ? { webhookUrl: `${origin}/api/mollie/webhook` } : {}),
        locale: "nl_NL",
        metadata: { userId: user.id, product: productId },
      });
      await run("INSERT INTO payments (id, user_id, product, amount, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)", payment.id, user.id, productId, product.price, now());
      return json({ url: payment._links.checkout.href });
    },

    // Terug van Mollie: openstaande betalingen van deze gebruiker nacontroleren.
    "POST /api/checkout/verify": async (_req, _body, user) => {
      if (mollie) {
        const open = await all("SELECT id FROM payments WHERE user_id = ? AND status NOT IN ('paid', 'failed', 'canceled', 'expired') AND created_at > ?", user.id, now() - DAY);
        for (const p of open) await checkMolliePayment(p.id);
      }
      const last = await one("SELECT product, status FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", user.id);
      return json({ last });
    },
  };

  return async function handle(req) {
    const { pathname } = new URL(req.url);
    const key = `${req.method} ${pathname}`;
    const isJson = (req.headers.get("Content-Type") || "").includes("application/json");
    const body = req.method === "POST" && isJson ? await req.json().catch(() => ({})) : {};

    try {
      if (publicRoutes[key]) return await publicRoutes[key](req, body);
      if (!userRoutes[key]) return fail(404, "Niet gevonden.");
      const user = await currentUser(req);
      if (!user) return fail(401, "Log eerst in.");
      return await userRoutes[key](req, body, user);
    } catch (err) {
      console.error(err);
      return fail(500, "Er ging iets mis. Probeer het nog eens.");
    }
  };
}

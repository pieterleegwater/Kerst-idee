import { CARDS, CARD_BY_ID, GROUPS, GAME_NAME, TYPES, PUBLISHED_ODDS, RARITIES, SEASON, drawPack, cryptoRandom } from "./cards.js";
import { hashPassword, randomHex, verifyPassword } from "./auth.js";
import { centsToMollie } from "./mollie.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const RULES = {
  free: { interval: 12 * HOUR, max: 2 },
  premium: { interval: 6 * HOUR, max: 4 },
  tradesPerDay: 5,
  openTradesMax: 10,
  sessionDays: 30,
};

export const PASS = { label: "Seizoenspas (30 dagen)", price: 499, days: 30 };

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
const fail = (status, error) => json({ error }, status);

// Pakjes laden vanzelf op: 1 per interval, tot het maximum.
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

  async function countOf(userId, cardId) {
    const row = await one("SELECT count FROM collection WHERE user_id = ? AND card_id = ?", userId, cardId);
    return row ? row.count : 0;
  }

  async function grantPremium(userId, paymentId) {
    const marked = await run("UPDATE payments SET status = 'paid' WHERE id = ? AND status != 'paid'", paymentId);
    if (marked.meta.changes !== 1) return; // al verwerkt
    const user = await one("SELECT premium_until FROM users WHERE id = ?", userId);
    const from = Math.max(now(), user.premium_until);
    await run("UPDATE users SET premium_until = ? WHERE id = ?", from + PASS.days * DAY, userId);
  }

  async function checkMolliePayment(paymentId) {
    const row = await one("SELECT * FROM payments WHERE id = ?", paymentId);
    if (!row || row.status === "paid") return;
    const payment = await mollie.getPayment(paymentId);
    if (payment.status === "paid" && payment.metadata?.userId === row.user_id) await grantPremium(row.user_id, paymentId);
    else if (payment.status !== row.status) await run("UPDATE payments SET status = ? WHERE id = ? AND status != 'paid'", payment.status, paymentId);
  }

  const publicRoutes = {
    "GET /api/catalog": async () =>
      json({ game: GAME_NAME, season: SEASON, groups: GROUPS.map(({ id, name, colors, title }) => ({ id, name, colors, title })), types: TYPES, rarities: RARITIES, cards: CARDS, odds: PUBLISHED_ODDS, rules: RULES, pass: PASS, demoMode }),

    "POST /api/register": async (req, body) => {
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return fail(400, "Gebruikersnaam: 3–20 letters, cijfers of _.");
      if (password.length < 8) return fail(400, "Wachtwoord moet minstens 8 tekens zijn.");
      if (body.adult !== true) return fail(400, "Je moet 18 jaar of ouder zijn.");
      if (await one("SELECT 1 FROM users WHERE username = ?", username)) return fail(409, "Die gebruikersnaam is al bezet.");
      const { hash, salt } = await hashPassword(password);
      const id = crypto.randomUUID();
      await run(
        "INSERT INTO users (id, username, pass_hash, pass_salt, created_at, pack_credits, credits_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, username, hash, salt, new Date(now()).toISOString(), RULES.free.max, now()
      );
      return json({ ok: true }, 201, { "Set-Cookie": await startSession(req, id) });
    },

    "POST /api/login": async (req, body) => {
      const user = await one("SELECT * FROM users WHERE username = ?", String(body.username || "").trim());
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
      const tradesToday = (await one("SELECT COUNT(*) AS n FROM trades WHERE from_user = ? AND created_at > ?", user.id, now() - DAY)).n;
      return json({
        username: user.username,
        packs: { available: pack.credits, max: pack.max, nextAt: pack.nextAt },
        premiumUntil: user.premium_until > now() ? user.premium_until : null,
        packsOpened: user.packs_opened,
        collection: Object.fromEntries(rows.map((r) => [r.card_id, r.count])),
        tradesLeftToday: Math.max(0, RULES.tradesPerDay - tradesToday),
      });
    },

    "POST /api/packs/open": async (_req, _body, user) => {
      const pack = packState(user, now());
      if (pack.credits < 1) return fail(429, "Je hebt nu geen pakje. Kom straks terug!");
      const nextAt = pack.credits >= pack.max ? now() : pack.at;
      // Optimistisch slot: lukt alleen als niemand tegelijk een pakje opende.
      const res = await run(
        "UPDATE users SET pack_credits = ?, credits_at = ?, packs_opened = packs_opened + 1 WHERE id = ? AND pack_credits = ? AND credits_at = ?",
        pack.credits - 1, nextAt, user.id, user.pack_credits, user.credits_at
      );
      if (res.meta.changes !== 1) return fail(409, "Probeer het nog eens.");
      const cards = drawPack(random);
      await db.batch(
        cards.map((id) =>
          db.prepare("INSERT INTO collection (user_id, card_id, count) VALUES (?, ?, 1) ON CONFLICT (user_id, card_id) DO UPDATE SET count = count + 1").bind(user.id, id)
        )
      );
      return json({ cards });
    },

    "GET /api/trades": async (_req, _body, user) => {
      const rows = await all(
        `SELECT t.id, t.give_card, t.want_card, t.status, t.created_at, f.username AS from_name, r.username AS to_name, t.from_user = ? AS mine
         FROM trades t JOIN users f ON f.id = t.from_user JOIN users r ON r.id = t.to_user
         WHERE (t.from_user = ? OR t.to_user = ?) AND (t.status = 'open' OR t.created_at > ?)
         ORDER BY t.created_at DESC LIMIT 50`,
        user.id, user.id, user.id, now() - 7 * DAY
      );
      return json({ trades: rows.map((r) => ({ ...r, mine: !!r.mine })) });
    },

    "POST /api/trades": async (_req, body, user) => {
      const give = CARD_BY_ID.get(body.give);
      const want = CARD_BY_ID.get(body.want);
      if (!give || !want) return fail(400, "Onbekende kaart.");
      if (give.id === want.id) return fail(400, "Kies twee verschillende kaarten.");
      if (give.rarity !== want.rarity) return fail(400, "Je kunt alleen kaarten van dezelfde zeldzaamheid ruilen.");
      const to = await one("SELECT id FROM users WHERE username = ?", String(body.to || "").trim());
      if (!to) return fail(404, "Die speler bestaat niet.");
      if (to.id === user.id) return fail(400, "Je kunt niet met jezelf ruilen.");
      if ((await countOf(user.id, give.id)) < 2) return fail(400, "Je kunt alleen dubbele kaarten ruilen.");
      if ((await countOf(to.id, want.id)) < 2) return fail(400, "Die speler heeft deze kaart niet dubbel.");
      const today = await one("SELECT COUNT(*) AS n FROM trades WHERE from_user = ? AND created_at > ?", user.id, now() - DAY);
      if (today.n >= RULES.tradesPerDay) return fail(429, `Je kunt maximaal ${RULES.tradesPerDay} ruilvoorstellen per dag doen.`);
      const open = await one("SELECT COUNT(*) AS n FROM trades WHERE from_user = ? AND status = 'open'", user.id);
      if (open.n >= RULES.openTradesMax) return fail(429, "Je hebt al te veel open voorstellen.");
      const id = crypto.randomUUID();
      await run("INSERT INTO trades (id, from_user, to_user, give_card, want_card, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, user.id, to.id, give.id, want.id, now());
      return json({ id }, 201);
    },

    "POST /api/trades/:id/accept": async (_req, _body, user, tradeId) => {
      const trade = await one("SELECT * FROM trades WHERE id = ? AND to_user = ? AND status = 'open'", tradeId, user.id);
      if (!trade) return fail(404, "Dit voorstel bestaat niet (meer).");
      if ((await countOf(trade.from_user, trade.give_card)) < 2 || (await countOf(user.id, trade.want_card)) < 2) {
        await run("UPDATE trades SET status = 'failed' WHERE id = ?", trade.id);
        return fail(409, "Een van jullie heeft de kaart niet meer dubbel.");
      }
      const claimed = await run("UPDATE trades SET status = 'accepted' WHERE id = ? AND status = 'open'", trade.id);
      if (claimed.meta.changes !== 1) return fail(409, "Dit voorstel is al afgehandeld.");
      const add = "INSERT INTO collection (user_id, card_id, count) VALUES (?, ?, 1) ON CONFLICT (user_id, card_id) DO UPDATE SET count = count + 1";
      const take = "UPDATE collection SET count = count - 1 WHERE user_id = ? AND card_id = ?";
      try {
        // In één transactie; de CHECK (count >= 1) laat de hele ruil mislukken als iemand zijn laatste exemplaar zou verliezen.
        await db.batch([
          db.prepare(take).bind(trade.from_user, trade.give_card),
          db.prepare(take).bind(user.id, trade.want_card),
          db.prepare(add).bind(user.id, trade.give_card),
          db.prepare(add).bind(trade.from_user, trade.want_card),
        ]);
      } catch {
        await run("UPDATE trades SET status = 'failed' WHERE id = ?", trade.id);
        return fail(409, "De ruil is mislukt: een kaart was niet meer dubbel.");
      }
      return json({ ok: true });
    },

    "POST /api/trades/:id/decline": async (_req, _body, user, tradeId) => {
      const res = await run("UPDATE trades SET status = 'declined' WHERE id = ? AND to_user = ? AND status = 'open'", tradeId, user.id);
      return res.meta.changes ? json({ ok: true }) : fail(404, "Dit voorstel bestaat niet (meer).");
    },

    "POST /api/trades/:id/cancel": async (_req, _body, user, tradeId) => {
      const res = await run("UPDATE trades SET status = 'cancelled' WHERE id = ? AND from_user = ? AND status = 'open'", tradeId, user.id);
      return res.meta.changes ? json({ ok: true }) : fail(404, "Dit voorstel bestaat niet (meer).");
    },

    "POST /api/pass/checkout": async (req, _body, user) => {
      if (demoMode) {
        const id = `demo_${randomHex(8)}`;
        await run("INSERT INTO payments (id, user_id, status, created_at) VALUES (?, ?, 'open', ?)", id, user.id, now());
        await grantPremium(user.id, id);
        return json({ url: "/#/winkel?betaald=1" });
      }
      const origin = new URL(req.url).origin;
      const payment = await mollie.createPayment({
        amount: { currency: "EUR", value: centsToMollie(PASS.price) },
        description: `${GAME_NAME} – ${PASS.label}`,
        redirectUrl: `${origin}/#/winkel?betaald=1`,
        ...(origin.startsWith("https://") ? { webhookUrl: `${origin}/api/mollie/webhook` } : {}),
        locale: "nl_NL",
        metadata: { userId: user.id },
      });
      await run("INSERT INTO payments (id, user_id, status, created_at) VALUES (?, ?, 'open', ?)", payment.id, user.id, now());
      return json({ url: payment._links.checkout.href });
    },

    // Terug van Mollie: openstaande betalingen van deze gebruiker nacontroleren.
    "POST /api/pass/verify": async (_req, _body, user) => {
      if (mollie) {
        const open = await all("SELECT id FROM payments WHERE user_id = ? AND status NOT IN ('paid', 'failed', 'canceled', 'expired') AND created_at > ?", user.id, now() - DAY);
        for (const p of open) await checkMolliePayment(p.id);
      }
      const fresh = await one("SELECT premium_until FROM users WHERE id = ?", user.id);
      return json({ premiumUntil: fresh.premium_until > now() ? fresh.premium_until : null });
    },
  };

  return async function handle(req) {
    const { pathname } = new URL(req.url);
    const tradeMatch = pathname.match(/^\/api\/trades\/([0-9a-f-]{36})\/(accept|decline|cancel)$/);
    const key = `${req.method} ${tradeMatch ? `/api/trades/:id/${tradeMatch[2]}` : pathname}`;
    const isJson = (req.headers.get("Content-Type") || "").includes("application/json");
    const body = req.method === "POST" && isJson ? await req.json().catch(() => ({})) : {};

    try {
      if (publicRoutes[key]) return await publicRoutes[key](req, body);
      if (!userRoutes[key]) return fail(404, "Niet gevonden.");
      const user = await currentUser(req);
      if (!user) return fail(401, "Log eerst in.");
      return await userRoutes[key](req, body, user, tradeMatch?.[1]);
    } catch (err) {
      console.error(err);
      return fail(500, "Er ging iets mis. Probeer het nog eens.");
    }
  };
}

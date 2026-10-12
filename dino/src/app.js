import { CARDS, GROUPS, GAME_NAME, TYPES, PUBLISHED_ODDS, RARITIES, SEASON, VARIANTS, KRISTAL_CAP, RARITY_POINTS, FOSSILS, drawPack, cryptoRandom, keyOf, parseKey, pointsOf, dustValue, craftCost } from "./cards.js";
import { hashPassword, randomHex, verifyPassword } from "./auth.js";
import { createMailer } from "./mail.js";
import { centsToMollie } from "./mollie.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const RULES = {
  free: { interval: 12 * HOUR, max: 2 },
  premium: { interval: 6 * HOUR, max: 4 },
  sessionDays: 30,
  // Tegen massaal accounts aanmaken (bijvoorbeeld voor gratis eieren):
  accountsPerIpPerDay: 3,
  accountsPerHourTotal: 300,
  // Tegen wachtwoorden raden: maximaal zoveel mislukte pogingen per kwartier.
  loginFailsPerAccount: 10,
  loginFailsPerIp: 30,
  resetLinkMinutes: 60,
  resetsPerHour: 3,
  leaderboardSize: 50,
  // Vrienden uitnodigen: allebei een extra ei; de uitnodiger maximaal zoveel keer per 30 dagen.
  referralsPer30d: 10,
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

// IP-adres van de bezoeker. Netlify en Cloudflare zetten hiervoor een eigen header die de bezoeker niet kan vervalsen.
function clientIp(req) {
  const h = req.headers;
  return h.get("x-nf-client-connection-ip") || h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || "onbekend";
}

// We bewaren het IP-adres nooit zelf, alleen een hash ervan (AVG).
async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const hashIp = (ip, salt) => sha256(`${salt}:${ip}`);

const normEmail = (e) => String(e || "").trim().toLowerCase();
const validEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const scoreOf = (keys) => keys.reduce((sum, k) => sum + pointsOf(k), 0);
const isUniqueViolation = (err) => err?.code === "23505" || /UNIQUE constraint/i.test(err?.message || "");
// Betalingen die meetellen voor de bestedingslimiet ('reserving' = net aangevraagd, Mollie nog bezig).
const COUNTED = "('paid', 'open', 'pending', 'authorized', 'reserving')";

function readCookie(req, name) {
  const match = (req.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export function createApp({ db, mollie, mailer = createMailer(), now = () => Date.now(), random = cryptoRandom, ipSalt = "dinorijk" }) {
  const demoMode = !mollie;

  const one = (sql, ...args) => db.prepare(sql).bind(...args).first();
  const all = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
  const run = (sql, ...args) => db.prepare(sql).bind(...args).run();
  // Laat gelijktijdige verzoeken met dezelfde naam op elkaar wachten: als eerste statement in een batch
  // houdt dit in Postgres een rijslot vast tot de transactie klaar is (SQLite/D1 doet batches al na elkaar).
  const lock = (name) => db.prepare("INSERT INTO locks (name, at) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET at = excluded.at").bind(name, now());
  let dummyHash; // zodat inloggen met een onbekende naam even lang duurt als met een bestaande
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
    const row = await one(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE user_id = ? AND status IN ${COUNTED} AND created_at > ?`, userId, now() - 30 * DAY);
    return row.total;
  }

  // Levert een betaald product precies één keer: leveren en 'paid' zetten gebeuren samen in één transactie.
  async function fulfil(paymentId) {
    const pay = await one("SELECT user_id, product FROM payments WHERE id = ?", paymentId);
    if (!pay || !Object.hasOwn(PRODUCTS, pay.product)) return;
    const product = PRODUCTS[pay.product];
    const notPaid = "EXISTS (SELECT 1 FROM payments WHERE id = ? AND status != 'paid')";
    const t = now();
    await db.batch([
      db.prepare("UPDATE payments SET status = status WHERE id = ?").bind(paymentId), // slot: een tweede levering wacht hierop
      product.eggs
        ? db.prepare(`UPDATE users SET bought_eggs = bought_eggs + ? WHERE id = ? AND ${notPaid}`).bind(product.eggs, pay.user_id, paymentId)
        : db.prepare(`UPDATE users SET premium_until = (CASE WHEN premium_until > ? THEN premium_until ELSE ? END) + ? WHERE id = ? AND ${notPaid}`).bind(t, t, product.days * DAY, pay.user_id, paymentId),
      db.prepare("UPDATE payments SET status = 'paid' WHERE id = ?").bind(paymentId),
    ]);
  }

  async function checkMolliePayment(paymentId) {
    let row = await one("SELECT * FROM payments WHERE id = ?", paymentId);
    if (row?.status === "paid") return;
    const payment = await mollie.getPayment(paymentId);
    // Kon het Mollie-id na het aanmaken niet worden opgeslagen? Dan vinden we de reservering via de metadata.
    if (!row && payment.metadata?.ref) {
      await run("UPDATE payments SET id = ?, status = 'open' WHERE id = ? AND status = 'reserving'", paymentId, String(payment.metadata.ref));
      row = await one("SELECT * FROM payments WHERE id = ?", paymentId);
    }
    if (!row) return;
    if (payment.status === "paid" && payment.metadata?.userId === row.user_id) await fulfil(paymentId);
    else if (payment.status !== row.status && payment.status !== "paid") await run("UPDATE payments SET status = ? WHERE id = ? AND status != 'paid'", payment.status, paymentId);
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
        mail: mailer.configured !== false,
      }),

    "POST /api/register": async (req, body) => {
      const username = String(body.username || "").trim();
      const email = normEmail(body.email);
      const password = String(body.password || "");
      if (!validEmail(email)) return fail(400, "Vul een geldig e-mailadres in.");
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return fail(400, "Gebruikersnaam: 3–20 letters, cijfers of _.");
      if (password.length < 8) return fail(400, "Wachtwoord moet minstens 8 tekens zijn.");
      if (body.adult !== true) return fail(400, "Je moet 18 jaar of ouder zijn.");
      // Onzichtbaar veld: mensen zien het niet, simpele bots vullen het wel in.
      if (body.website) return fail(400, "Er ging iets mis. Probeer het opnieuw.");
      const nameTaken = "Die gebruikersnaam is al bezet.";
      const emailTaken = "Er bestaat al een account met dit e-mailadres. Log in, of gebruik 'Wachtwoord vergeten'.";
      if (await one("SELECT 1 FROM users WHERE lower(username) = lower(?)", username)) return fail(409, nameTaken);
      if (await one("SELECT 1 FROM users WHERE email = ?", email)) return fail(409, emailTaken);
      // Plek reserveren binnen de limieten, in één keer (ook als er tientallen tegelijk binnenkomen).
      const ipHash = await hashIp(clientIp(req), ipSalt);
      const [, reserved] = await db.batch([
        lock("register"),
        db
          .prepare(
            `INSERT INTO registrations (ip_hash, created_at) SELECT CAST(? AS TEXT), CAST(? AS BIGINT)
             WHERE (SELECT COUNT(*) FROM registrations WHERE ip_hash = ? AND created_at > ?) < ? AND (SELECT COUNT(*) FROM registrations WHERE created_at > ?) < ?`
          )
          .bind(ipHash, now(), ipHash, now() - DAY, RULES.accountsPerIpPerDay, now() - HOUR, RULES.accountsPerHourTotal),
      ]);
      if (reserved.meta.changes !== 1) {
        const fromIp = await one("SELECT COUNT(*) AS n FROM registrations WHERE ip_hash = ? AND created_at > ?", ipHash, now() - DAY);
        return fromIp.n >= RULES.accountsPerIpPerDay
          ? fail(429, `Vanaf dit netwerk zijn vandaag al ${RULES.accountsPerIpPerDay} accounts aangemaakt. Probeer het morgen opnieuw, of log in met je bestaande account.`)
          : fail(429, "Het is even heel druk. Probeer het over een uurtje opnieuw.");
      }
      // Uitgenodigd door een vriend? Dan een extra ei, maar niet vanaf hetzelfde netwerk als de uitnodiger (nep-accounts).
      const refName = typeof body.ref === "string" ? body.ref.trim().slice(0, 20) : "";
      const referrer = refName ? await one("SELECT id, reg_ip_hash FROM users WHERE lower(username) = lower(?)", refName) : null;
      const invited = !!referrer && referrer.reg_ip_hash !== ipHash;
      const { hash, salt } = await hashPassword(password);
      const id = crypto.randomUUID();
      try {
        await run(
          "INSERT INTO users (id, username, email, pass_hash, pass_salt, created_at, pack_credits, credits_at, bought_eggs, referred_by, reg_ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          id, username, email, hash, salt, new Date(now()).toISOString(), RULES.free.max, now(), invited ? 1 : 0, invited ? referrer.id : null, ipHash
        );
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Iemand anders was ons net voor met dezelfde naam of hetzelfde e-mailadres.
        return fail(409, (await one("SELECT 1 FROM users WHERE email = ?", email)) ? emailTaken : nameTaken);
      }
      return json({ ok: true, invited, sameNetwork: !!referrer && !invited }, 201, { "Set-Cookie": await startSession(req, id) });
    },

    "POST /api/login": async (req, body) => {
      const login = String(body.login ?? body.username ?? "").trim().slice(0, 254);
      const password = String(body.password || "");
      const acctKey = await sha256(`${ipSalt}:login:${login.toLowerCase()}`);
      const ipKey = await sha256(`${ipSalt}:login-ip:${clientIp(req)}`);
      const fails = await one(
        "SELECT SUM(CASE WHEN key_hash = ? THEN 1 ELSE 0 END) AS acct, SUM(CASE WHEN key_hash = ? THEN 1 ELSE 0 END) AS ip FROM login_fails WHERE key_hash IN (?, ?) AND created_at > ?",
        acctKey, ipKey, acctKey, ipKey, now() - 15 * 60 * 1000
      );
      if ((fails?.acct || 0) >= RULES.loginFailsPerAccount || (fails?.ip || 0) >= RULES.loginFailsPerIp) {
        return fail(429, "Te veel mislukte pogingen. Wacht een kwartiertje, of gebruik 'Wachtwoord vergeten'.");
      }
      const user = login.includes("@")
        ? await one("SELECT * FROM users WHERE email = ?", normEmail(login))
        : await one("SELECT * FROM users WHERE lower(username) = lower(?)", login);
      dummyHash ??= await hashPassword("dummy-wachtwoord");
      const good = user ? await verifyPassword(password, user.pass_salt, user.pass_hash) : (await verifyPassword(password, dummyHash.salt, dummyHash.hash), false);
      if (!user || !good) {
        await db.batch([
          db.prepare("INSERT INTO login_fails (key_hash, created_at) VALUES (?, ?)").bind(acctKey, now()),
          db.prepare("INSERT INTO login_fails (key_hash, created_at) VALUES (?, ?)").bind(ipKey, now()),
        ]);
        return fail(401, "E-mail/gebruikersnaam of wachtwoord klopt niet.");
      }
      return json({ ok: true }, 200, { "Set-Cookie": await startSession(req, user.id) });
    },

    "POST /api/logout": async (req) => {
      const token = readCookie(req, "sid");
      if (token) await run("DELETE FROM sessions WHERE token = ?", token);
      return json({ ok: true }, 200, { "Set-Cookie": "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
    },

    // Altijd hetzelfde antwoord, zodat niemand kan uitproberen welke e-mailadressen een account hebben.
    "POST /api/password/forgot": async (req, body) => {
      const email = normEmail(body.email);
      const ok = json({ ok: true, message: "Als dit e-mailadres bij een account hoort, sturen we binnen een paar minuten een link." });
      if (!validEmail(email)) return ok;
      const user = await one("SELECT id, username FROM users WHERE email = ?", email);
      if (!user) return ok;
      const recent = await one("SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ? AND created_at > ?", user.id, now() - HOUR);
      if (recent.n >= RULES.resetsPerHour) return ok;
      const token = randomHex(32);
      await run(
        "INSERT INTO password_resets (token_hash, user_id, created_at, expires_at, used) VALUES (?, ?, ?, ?, 0)",
        await sha256(token), user.id, now(), now() + RULES.resetLinkMinutes * 60 * 1000
      );
      const link = `${new URL(req.url).origin}/#/reset?token=${token}`;
      await mailer.send({
        to: email,
        subject: `${GAME_NAME}: nieuw wachtwoord instellen`,
        text: `Hoi ${user.username},\n\nKlik op deze link om een nieuw wachtwoord in te stellen (${RULES.resetLinkMinutes} minuten geldig):\n${link}\n\nHeb je dit niet aangevraagd? Dan kun je deze mail negeren.\n\nGroeten van ${GAME_NAME} 🦖`,
        html: `<p>Hoi ${user.username},</p><p>Klik op de knop om een nieuw wachtwoord in te stellen. De link is ${RULES.resetLinkMinutes} minuten geldig.</p><p><a href="${link}" style="background:#ffb703;color:#2b1a05;padding:12px 20px;border-radius:99px;text-decoration:none;font-weight:bold">Nieuw wachtwoord instellen</a></p><p style="color:#777">Heb je dit niet aangevraagd? Dan kun je deze mail negeren.</p>`,
      }).catch((err) => console.error("Resetmail niet verstuurd:", err.message)); // zelfde antwoord, ook als de mail faalt
      return ok;
    },

    "POST /api/password/reset": async (req, body) => {
      const token = String(body.token || "");
      const password = String(body.password || "");
      if (password.length < 8) return fail(400, "Wachtwoord moet minstens 8 tekens zijn.");
      const tokenHash = await sha256(token);
      const reset = await one("SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?", tokenHash, now());
      if (!reset) return fail(400, "Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.");
      const claimed = await run("UPDATE password_resets SET used = 1 WHERE token_hash = ? AND used = 0", tokenHash);
      if (claimed.meta.changes !== 1) return fail(400, "Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.");
      const { hash, salt } = await hashPassword(password);
      await run("UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?", hash, salt, reset.user_id);
      await run("UPDATE password_resets SET used = 1 WHERE user_id = ?", reset.user_id); // andere resetlinks vervallen
      await run("DELETE FROM sessions WHERE user_id = ?", reset.user_id); // overal uitloggen
      return json({ ok: true }, 200, { "Set-Cookie": await startSession(req, reset.user_id) });
    },

    "GET /api/leaderboard": async (req) => {
      const rows = await all("SELECT username, score, packs_opened FROM users WHERE score > 0 ORDER BY score DESC, created_at ASC LIMIT ?", RULES.leaderboardSize);
      let mine = null;
      const user = await currentUser(req);
      if (user) {
        const ahead = await one("SELECT COUNT(*) AS n FROM users WHERE score > ?", user.score);
        mine = { username: user.username, score: user.score, rank: ahead.n + 1 };
      }
      return json({ top: rows.map((r, i) => ({ rank: i + 1, username: r.username, score: r.score, eggs: r.packs_opened })), mine });
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
      const value = rows.reduce((sum, r) => sum + pointsOf(r.card_id) * r.count, 0);
      const friends = await one(
        "SELECT SUM(CASE WHEN referral_rewarded > 0 THEN 1 ELSE 0 END) AS joined, SUM(CASE WHEN referral_rewarded = 0 THEN 1 ELSE 0 END) AS waiting FROM users WHERE referred_by = ?",
        user.id
      );
      if (value !== user.score) await run("UPDATE users SET score = ? WHERE id = ?", value, user.id); // ranglijst bijwerken
      return json({
        username: user.username,
        email: user.email || null,
        packs: { available: pack.credits, max: pack.max, nextAt: pack.nextAt, bought: user.bought_eggs },
        premiumUntil: user.premium_until > now() ? user.premium_until : null,
        packsOpened: user.packs_opened,
        fossils: user.fossils,
        collection: Object.fromEntries(rows.map((r) => [r.card_id, r.count])),
        prints: prints.map((p) => ({ cardId: p.card_id, serial: p.serial })),
        value,
        spendLeft: Math.max(0, RULES.spendCap30d - spent),
        invite: { joined: friends?.joined || 0, waiting: friends?.waiting || 0 },
      });
    },

    // E-mailadres toevoegen of wijzigen (vraagt je huidige wachtwoord).
    "POST /api/account/email": async (_req, body, user) => {
      const email = normEmail(body.email);
      if (!validEmail(email)) return fail(400, "Vul een geldig e-mailadres in.");
      if (!(await verifyPassword(String(body.password || ""), user.pass_salt, user.pass_hash))) return fail(401, "Je wachtwoord klopt niet.");
      const taken = await one("SELECT id FROM users WHERE email = ? AND id != ?", email, user.id);
      if (taken) return fail(409, "Dit e-mailadres hoort al bij een ander account.");
      await run("UPDATE users SET email = ? WHERE id = ?", email, user.id);
      return json({ ok: true, email });
    },

    // AVG: al je gegevens als bestand (inzage en overdraagbaarheid).
    "GET /api/account/export": async (_req, _body, user) => {
      const collection = await all("SELECT card_id, count FROM collection WHERE user_id = ? ORDER BY card_id", user.id);
      const prints = await all("SELECT card_id, serial, created_at FROM prints WHERE user_id = ? ORDER BY created_at", user.id);
      const payments = await all("SELECT product, amount, status, created_at FROM payments WHERE user_id = ? AND status != 'reserving' ORDER BY created_at", user.id);
      const data = {
        exportedAt: new Date(now()).toISOString(),
        account: { username: user.username, email: user.email || null, createdAt: user.created_at, invitedByAFriend: !!user.referred_by },
        game: { packsOpened: user.packs_opened, fossils: user.fossils, boughtEggsLeft: user.bought_eggs, score: user.score, premiumUntil: user.premium_until > now() ? new Date(user.premium_until).toISOString() : null },
        collection: Object.fromEntries(collection.map((r) => [r.card_id, r.count])),
        oerkristal: prints.map((p) => ({ card: p.card_id, serial: p.serial, at: new Date(p.created_at).toISOString() })),
        payments: payments.map((p) => ({ product: p.product, amountEuro: p.amount / 100, status: p.status, at: new Date(p.created_at).toISOString() })),
      };
      return new Response(JSON.stringify(data, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dinorijk-gegevens-${user.username}.json"` },
      });
    },

    // AVG: account verwijderen. Persoonsgegevens en kaarten gaan weg; betalingen blijven anoniem bewaard (fiscale bewaarplicht).
    "POST /api/account/delete": async (_req, body, user) => {
      if (!(await verifyPassword(String(body.password || ""), user.pass_salt, user.pass_hash))) return fail(401, "Je wachtwoord klopt niet.");
      const { hash, salt } = await hashPassword(randomHex(32)); // niemand kan hier nog mee inloggen
      await db.batch([
        db.prepare("UPDATE users SET username = ?, email = NULL, pass_hash = ?, pass_salt = ?, score = 0, fossils = 0, bought_eggs = 0, pack_credits = 0, premium_until = 0, reg_ip_hash = NULL, referred_by = NULL WHERE id = ?").bind(`verwijderd_${randomHex(6)}`, hash, salt, user.id),
        db.prepare("DELETE FROM collection WHERE user_id = ?").bind(user.id),
        db.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(user.id),
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      ]);
      return json({ ok: true }, 200, { "Set-Cookie": "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
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
      // Eerste ei van een uitgenodigde vriend: nu krijgt de uitnodiger ook een ei (max per 30 dagen).
      if (user.referred_by && !user.referral_rewarded) {
        const claim = await run("UPDATE users SET referral_rewarded = ? WHERE id = ? AND referral_rewarded = 0", now(), user.id);
        if (claim.meta.changes === 1) {
          await run(
            "UPDATE users SET bought_eggs = bought_eggs + 1 WHERE id = ? AND (SELECT COUNT(*) FROM users WHERE referred_by = ? AND referral_rewarded > ?) <= ?",
            user.referred_by, user.referred_by, now() - 30 * DAY, RULES.referralsPer30d
          );
        }
      }

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
      await db.batch([
        ...cards.map(({ key }) => addCard(user.id, key)),
        db.prepare("UPDATE users SET score = score + ? WHERE id = ?").bind(scoreOf(cards.map((c) => c.key)), user.id),
      ]);
      return json({ cards });
    },

    // Versteen kaarten tot fossielen.
    "POST /api/fossils/dust": async (_req, body, user) => {
      const parsed = typeof body.key === "string" ? parseKey(body.key) : null;
      if (!parsed) return fail(400, "Onbekende kaart.");
      const key = keyOf(parsed.card.id, parsed.variant);
      const per = dustValue(parsed.card, parsed.variant);
      if (per == null) return fail(400, "Oerkristal-kaarten zijn genummerd en kun je niet verstenen.");
      const n = body.count === undefined ? 1 : Number(body.count);
      const owned = (await one("SELECT count FROM collection WHERE user_id = ? AND card_id = ?", user.id, key))?.count || 0;
      if (!Number.isInteger(n) || n < 1 || n > owned) return fail(400, "Zoveel heb je er niet.");
      if (!(await takeCards(user.id, key, n, owned))) return fail(409, "Probeer het nog eens.");
      await run("UPDATE users SET fossils = fossils + ?, score = score - ? WHERE id = ?", per * n, pointsOf(key) * n, user.id);
      return json({ gained: per * n });
    },

    // Versteen alle dubbele kaarten in één keer (je houdt van elke versie er één).
    "POST /api/fossils/dust-dupes": async (_req, _body, user) => {
      const rows = await all("SELECT card_id, count FROM collection WHERE user_id = ? AND count > 1", user.id);
      let gained = 0;
      let lost = 0;
      for (const r of rows) {
        const p = parseKey(r.card_id);
        const per = p && dustValue(p.card, p.variant);
        if (per == null) continue;
        if (await takeCards(user.id, r.card_id, r.count - 1, r.count)) {
          gained += per * (r.count - 1);
          lost += pointsOf(r.card_id) * (r.count - 1);
        }
      }
      if (gained) await run("UPDATE users SET fossils = fossils + ?, score = score - ? WHERE id = ?", gained, lost, user.id);
      return json({ gained });
    },

    // Maak een dino naar keuze van fossielen (alleen Normaal of Holo).
    "POST /api/fossils/craft": async (_req, body, user) => {
      const parsed = typeof body.key === "string" ? parseKey(body.key) : null;
      if (!parsed) return fail(400, "Onbekende kaart.");
      const cost = craftCost(parsed.card, parsed.variant);
      if (cost == null) return fail(400, "Goudfolie, Prisma en Oerkristal vind je alleen in eieren.");
      const res = await run("UPDATE users SET fossils = fossils - ? WHERE id = ? AND fossils >= ?", cost, user.id, cost);
      if (res.meta.changes !== 1) return fail(400, `Je hebt ${cost} fossielen nodig.`);
      const key = keyOf(parsed.card.id, parsed.variant);
      await db.batch([addCard(user.id, key), db.prepare("UPDATE users SET score = score + ? WHERE id = ?").bind(pointsOf(key), user.id)]);
      return json({ ok: true, cost });
    },

    "POST /api/checkout": async (req, body, user) => {
      const productId = typeof body.product === "string" ? body.product : "";
      if (!Object.hasOwn(PRODUCTS, productId)) return fail(400, "Onbekend product.");
      const product = PRODUCTS[productId];
      // Digitale inhoud: de koper moet vooraf instemmen met directe levering en afstand doen van de bedenktijd (art. 6:230p BW).
      if (body.waiver !== true) return fail(400, "Vink eerst aan dat je je aankoop direct wilt ontvangen.");
      // Eerst het bedrag reserveren binnen de limiet (in één keer, ook bij gelijktijdige klikken), dan pas naar Mollie.
      const ref = `${demoMode ? "demo" : "res"}_${randomHex(12)}`;
      const [, reserved] = await db.batch([
        lock(`pay:${user.id}`),
        db
          .prepare(
            `INSERT INTO payments (id, user_id, product, amount, status, created_at)
             SELECT CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS INTEGER), 'reserving', CAST(? AS BIGINT)
             WHERE (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE user_id = ? AND status IN ${COUNTED} AND created_at > ?) + ? <= ?`
          )
          .bind(ref, user.id, productId, product.price, now(), user.id, now() - 30 * DAY, product.price, RULES.spendCap30d),
      ]);
      if (reserved.meta.changes !== 1) {
        return fail(429, `Je zit aan je limiet van €${RULES.spendCap30d / 100} per 30 dagen. Dat is er om je te beschermen.`);
      }
      if (demoMode) {
        await fulfil(ref);
        return json({ url: "/#/winkel?betaald=1" });
      }
      const origin = new URL(req.url).origin;
      let payment;
      try {
        payment = await mollie.createPayment({
          amount: { currency: "EUR", value: centsToMollie(product.price) },
          description: `${GAME_NAME} – ${product.label}`,
          redirectUrl: `${origin}/#/winkel?betaald=1`,
          ...(origin.startsWith("https://") ? { webhookUrl: `${origin}/api/mollie/webhook` } : {}),
          locale: "nl_NL",
          metadata: { userId: user.id, product: productId, ref },
        });
      } catch (err) {
        await run("DELETE FROM payments WHERE id = ?", ref);
        throw err;
      }
      await run("UPDATE payments SET id = ?, status = 'open' WHERE id = ? AND status = 'reserving'", payment.id, ref);
      return json({ url: payment._links.checkout.href });
    },

    // Terug van Mollie: openstaande betalingen van deze gebruiker nacontroleren.
    "POST /api/checkout/verify": async (_req, _body, user) => {
      if (mollie) {
        const open = await all("SELECT id FROM payments WHERE user_id = ? AND status NOT IN ('paid', 'failed', 'canceled', 'expired', 'reserving') AND created_at > ?", user.id, now() - DAY);
        for (const p of open) await checkMolliePayment(p.id);
      }
      const last = await one("SELECT product, status FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", user.id);
      return json({ last });
    },
  };

  return async function handle(req) {
    const { pathname } = new URL(req.url);
    const key = `${req.method} ${pathname}`;
    // Alleen echte JSON: 'text/plain' mag een andere website ongevraagd sturen, 'application/json' niet.
    const isJson = (req.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase() === "application/json";
    const parsed = req.method === "POST" && isJson ? await req.json().catch(() => null) : null;
    const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};

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

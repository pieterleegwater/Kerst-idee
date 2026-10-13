import { dinoSvg, setDinoImages } from "./art.js";
import { renderShareImage, shareBlob, downloadBlob } from "./share.js";
import { privacyHtml, termsHtml } from "./legal.js";
import { startShake, hatch, deal, bestTier, crumble, bonesToBank, forge } from "./fx.js";

const view = document.getElementById("view");
const nav = document.getElementById("nav");
let catalog;
let me = null;

// Uitnodigingslink (?vriend=naam): onthouden tot iemand zich aanmeldt, en de adresbalk weer opschonen.
const REF_KEY = "dinorijk-vriend";
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
{
  const ref = new URLSearchParams(location.search).get("vriend");
  if (ref && /^[A-Za-z0-9_]{3,20}$/.test(ref)) {
    store.set(REF_KEY, JSON.stringify({ name: ref, at: Date.now() }));
    history.replaceState(null, "", location.pathname + location.hash);
  }
}
function invitedBy() {
  try {
    const r = JSON.parse(store.get(REF_KEY));
    return r && Date.now() - r.at < 14 * 24 * 3600 * 1000 ? r.name : null;
  } catch {
    return null;
  }
}

// ---------- Hulpjes ----------
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "class") node.className = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false && c !== "") node.append(c);
  return node;
};

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Er ging iets mis."), { status: res.status });
  return data;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("on"), 2800);
}

// Voeg alleen echte kinderen toe (null/false/"" overslaan).
const put = (node, method, ...kids) => node[method](...kids.flat().filter((k) => k != null && k !== false && k !== ""));

const groupOf = (id) => catalog.groups.find((g) => g.id === id);
const cardOf = (id) => catalog.cards.find((c) => c.id === id);
const keyOf = (id, variant = "normaal") => (variant === "normaal" ? id : `${id}:${variant}`);
const parseKey = (key) => {
  const [id, variant = "normaal"] = key.split(":");
  return { card: cardOf(id), variant };
};
const VARIANT_ORDER = ["kristal", "prisma", "goud", "holo", "normaal"];
const ownedVariants = (cardId) => VARIANT_ORDER.filter((v) => me.collection[keyOf(cardId, v)]);
const totalOwned = (cardId) => VARIANT_ORDER.reduce((n, v) => n + (me.collection[keyOf(cardId, v)] || 0), 0);
const serialsOf = (cardId) => me.prints.filter((p) => p.cardId === cardId).map((p) => p.serial);
const oneIn = (p) => `1 op ${Math.round(1 / p).toLocaleString("nl-NL")}`;
const fmtTime = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} u ${m % 60} min` : `${m} min`;
};
const GEMS = { brons: "◆", zilver: "◆◆", goud: "◆◆◆", icoon: "★" };

// ---------- Kaart ----------
function cardEl(card, { variant = "normaal", count = 0, missing = false, serial = null, chips = null } = {}) {
  const group = groupOf(card.group);
  const v = catalog.variants[variant];
  const node = el("div", {
    class: `card r-${card.rarity} v-${variant}${missing ? " missing" : ""}`,
    title: missing ? `#${card.number} – nog niet gevonden` : `${card.name} (${card.species})${variant !== "normaal" ? ` · ${v.label}` : ""}`,
  });
  node.style.setProperty("--c1", group.colors[0]);
  node.style.setProperty("--c2", group.colors[1]);
  const art = el("div", { class: "art" });
  art.innerHTML = dinoSvg(card, group, { variant, silhouette: missing });
  if (missing) {
    node.append(el("div", { class: "inner" }, art, el("div", { class: "plate" }, el("b", { class: "name" }, "???"), el("span", { class: "sub" }, group.name)), el("div", { class: "foot" }, el("span", {}, `#${card.number}`))));
    return node;
  }
  put(
    node,
    "append",
    el(
      "div",
      { class: "inner" },
      art,
      el("div", { class: "top" }, el("b", { class: "rating" }, String(card.rating)), el("div", { class: "meta" }, el("span", { class: "pos" }, card.pos), el("span", { class: "tier" }, catalog.rarities[card.rarity].label)), el("span", { class: "gems" }, GEMS[card.rarity])),
      el("div", { class: "plate" }, el("b", { class: `name${card.name.length > 15 ? " long" : ""}` }, card.name), el("span", { class: "sub" }, `${card.species} · ${group.name}`)),
      el("div", { class: "stats" }, Object.entries(card.stats).map(([k, val]) => el("span", {}, el("b", {}, String(val)), k))),
      el(
        "div",
        { class: "foot" },
        el("span", {}, `#${String(card.number).padStart(3, "0")} · S${catalog.season}`),
        variant !== "normaal" ? el("span", { class: "vtag" }, v.label) : null,
        serial ? el("span", { class: "serial" }, `${String(serial).padStart(2, "0")}/${catalog.kristalCap}`) : null
      )
    ),
    el("div", { class: "fx" }),
    el("div", { class: "glare" }),
    count > 1 ? el("span", { class: "count" }, `×${count}`) : null,
    chips && chips.length > 1 ? el("div", { class: "chips" }, chips.map((c) => el("i", { class: `chip c-${c}`, title: catalog.variants[c].label }))) : null
  );
  return node;
}

// Kaarten kantelen mee met muis of vinger; de glans volgt.
let tilted = null;
function resetTilt() {
  if (!tilted) return;
  tilted.style.transform = "";
  tilted.classList.remove("active");
  tilted = null;
}
document.addEventListener("pointermove", (e) => {
  const card = e.target.closest?.(".card:not(.missing)");
  if (card !== tilted) resetTilt();
  if (!card) return;
  tilted = card;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  card.classList.add("active");
  card.style.setProperty("--mx", `${x * 100}%`);
  card.style.setProperty("--my", `${y * 100}%`);
  card.style.transform = `perspective(800px) rotateY(${(x - 0.5) * 18}deg) rotateX(${(0.5 - y) * 18}deg) scale(1.03)`;
});
document.addEventListener("pointerleave", resetTilt);
document.addEventListener("scroll", resetTilt, { passive: true });

function celebrate(title, sub, cls) {
  const fx = el("div", { class: `celebrate ${cls}` }, el("div", { class: "burst" }), el("div", { class: "banner" }, el("b", {}, title), sub ? el("span", {}, sub) : null));
  document.body.append(fx);
  setTimeout(() => fx.remove(), 2600);
}

const dustOf = (card, v) => (v in catalog.fossils.dustMult ? catalog.fossils.dust[card.rarity] * catalog.fossils.dustMult[v] : null);
const craftOf = (card, v) => (v in catalog.fossils.craftMult ? catalog.fossils.craft[card.rarity] * catalog.fossils.craftMult[v] : null);

// Knoppen om een kaart te verstenen of (Normaal/Holo) bij te maken.
function fossilActions(card, variant, after) {
  const key = keyOf(card.id, variant);
  const owned = me.collection[key] || 0;
  const per = dustOf(card, variant);
  const box = el("div", { class: "factions" });
  const holder = () => box.closest(".detail")?.querySelector(".big");
  const act = async (path, body, msg, fx) => {
    if (box.classList.contains("busy")) return;
    box.classList.add("busy");
    const fossilsBefore = me.fossils;
    try {
      const res = await api(path, body);
      await fx?.(res, fossilsBefore);
      await refreshMe();
      toast(msg(res));
      after();
    } catch (ex) {
      toast(ex.message);
    } finally {
      box.classList.remove("busy");
    }
  };
  const dustFx = (r, before) => crumble(holder()?.querySelector(".card"), r.gained, before);
  if (per != null && owned) {
    box.append(el("button", { class: "btn small ghost", onclick: () => act("/api/fossils/dust", { key, count: 1 }, (r) => `+${r.gained} 🦴`, dustFx) }, `Versteen 1 (+${per} 🦴)`));
    if (owned > 1) box.append(el("button", { class: "btn small ghost", onclick: () => act("/api/fossils/dust", { key, count: owned - 1 }, (r) => `+${r.gained} 🦴`, dustFx) }, `Versteen ${owned - 1} dubbele (+${per * (owned - 1)} 🦴)`));
  } else if (variant === "kristal") box.append(el("p", { class: "muted" }, "🔒 Oerkristal is genummerd en kun je niet verstenen."));
  for (const v of ["normaal", "holo"]) {
    const cost = craftOf(card, v);
    box.append(el("button", { class: "btn small", disabled: me.fossils < cost, onclick: () => act("/api/fossils/craft", { key: keyOf(card.id, v) }, () => `${card.name} (${catalog.variants[v].label}) gemaakt!`, (r, before) => forge(holder(), cardEl(card, { variant: v }), r.cost, before)) }, `Maak ${catalog.variants[v].label} (${cost} 🦴)`));
  }
  box.append(el("p", { class: "muted small" }, `Je hebt ${me.fossils.toLocaleString("nl-NL")} 🦴 fossielen.`));
  return box;
}

// Deelvenster: maakt een Story-plaatje van de kaart; op de telefoon via het deelmenu naar Instagram/TikTok.
async function showShare(card, variant = "normaal", serial = null) {
  const group = groupOf(card.group);
  const close = () => overlay.remove();
  const preview = el("div", { class: "share-preview" }, el("p", { class: "muted" }, "Plaatje maken…"));
  const actions = el("div", { class: "share-actions" });
  const overlay = el("div", { class: "overlay share", onclick: (e) => e.target === overlay && close() }, el("div", { class: "detail share-box" }, preview, el("div", {}, el("h2", {}, "Deel je kaart"), el("p", { class: "muted" }, "Laat zien wat je hebt gevangen! Het plaatje heeft precies het formaat van een Instagram- of TikTok-verhaal."), actions)));
  document.body.append(overlay);
  const fileName = `dinorijk-${card.art}-${variant}.png`;
  const label = variant !== "normaal" ? `${catalog.variants[variant].label} ` : "";
  const text = `Ik heb ${label}${card.name} gevangen in DinoRijk! 🦖 Kun jij hem ook vangen? ${location.origin}`;
  try {
    const blob = await renderShareImage({ card, group, variant, serial, catalog });
    const img = el("img", { alt: `Deelplaatje van ${card.name}` });
    img.src = URL.createObjectURL(blob);
    preview.replaceChildren(img);
    const canShareFiles = navigator.canShare?.({ files: [new File([blob], fileName, { type: "image/png" })] });
    put(
      actions,
      "replaceChildren",
      canShareFiles
        ? el("button", { class: "btn", onclick: async () => {
            const res = await shareBlob(blob, { fileName, text });
            if (res === "unsupported") downloadBlob(blob, fileName), toast("Plaatje opgeslagen. Upload het in Instagram of TikTok.");
          } }, "📲 Delen op Instagram / TikTok")
        : null,
      el("button", { class: `btn${canShareFiles ? " ghost" : ""}`, onclick: () => (downloadBlob(blob, fileName), toast("Plaatje opgeslagen!")) }, "⬇️ Download plaatje"),
      el("button", { class: "btn ghost", onclick: async () => {
          try {
            await navigator.clipboard.writeText(text);
            toast("Tekst met link gekopieerd!");
          } catch {
            toast(text);
          }
        } }, "🔗 Kopieer tekst + link"),
      el(
        "p",
        { class: "muted small" },
        canShareFiles
          ? "Kies in het deelmenu Instagram (Verhaal of Bericht) of TikTok."
          : "Op je telefoon kun je direct delen. Op de computer: download het plaatje en upload het in Instagram of TikTok."
      ),
      el("button", { class: "btn ghost", onclick: close }, "Sluiten")
    );
  } catch (err) {
    console.error(err);
    preview.replaceChildren(el("p", { class: "error" }, "Het plaatje maken lukte niet. Probeer het nog eens."));
    actions.replaceChildren(el("button", { class: "btn ghost", onclick: close }, "Sluiten"));
  }
}

function showDetail(card) {
  const group = groupOf(card.group);
  const variants = ownedVariants(card.id);
  let current = variants[0];
  const close = () => overlay.remove();
  const big = el("div", { class: "big" });
  const info = el("div");
  const kristal = el("p", { class: "muted" });
  api("/api/kristal")
    .then(({ found, cap }) => {
      const n = found[card.id] || 0;
      kristal.textContent = n >= cap ? `Alle ${cap} Oerkristal-exemplaren van deze dino zijn gevonden.` : `Oerkristal: nog ${cap - n} van de ${cap} genummerde exemplaren te vinden in de wereld.`;
    })
    .catch(() => {});
  const render = () => {
    const serials = current === "kristal" ? serialsOf(card.id) : [];
    big.replaceChildren(cardEl(card, { variant: current, serial: serials[0] }));
    put(
      info,
      "replaceChildren",
      el("h2", {}, card.name),
      el("p", { class: "muted" }, `${catalog.rarities[card.rarity].label} · ${catalog.types[card.type].label} · ${group.name}`),
      el("p", {}, el("b", {}, `Echte soort: ${card.species}. `), card.fact),
      el(
        "div",
        { class: "vpick" },
        variants.map((v) => el("button", { class: v === current ? "on" : "", onclick: () => ((current = v), render()) }, `${catalog.variants[v].label} ×${me.collection[keyOf(card.id, v)]}`))
      ),
      serials.length ? el("p", {}, `Jouw serienummers: ${serials.map((s) => `#${String(s).padStart(2, "0")}`).join(", ")}`) : null,
      kristal,
      el("button", { class: "btn", onclick: () => showShare(card, current, current === "kristal" ? serialsOf(card.id)[0] : null) }, "📲 Delen"),
      fossilActions(card, current, () => {
        const left = ownedVariants(card.id);
        if (!left.length) return close(), route();
        if (!left.includes(current)) current = left[0];
        variants.splice(0, variants.length, ...left);
        render();
        route(true);
      }),
      el("button", { class: "btn ghost", onclick: close }, "Sluiten")
    );
  };
  render();
  const overlay = el("div", { class: "overlay", onclick: (e) => e.target === overlay && close() }, el("div", { class: "detail" }, big, info));
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") close(), document.removeEventListener("keydown", esc);
  });
  document.body.append(overlay);
}

// Ontbrekende dino: laten zien wat het kost om hem te maken.
function showCraft(card) {
  const group = groupOf(card.group);
  const close = () => overlay.remove();
  const overlay = el(
    "div",
    { class: "overlay", onclick: (e) => e.target === overlay && close() },
    el(
      "div",
      { class: "detail" },
      el("div", { class: "big" }, cardEl(card, { missing: true })),
      el(
        "div",
        {},
        el("h2", {}, `Nog niet gevonden: #${card.number}`),
        el("p", { class: "muted" }, `${catalog.rarities[card.rarity].label} · ${group.name}`),
        el("p", {}, "Broed hem uit in een ei, of maak hem nu met fossielen."),
        fossilActions(card, "normaal", () => (close(), route())),
        el("button", { class: "btn ghost", onclick: close }, "Sluiten")
      )
    )
  );
  document.body.append(overlay);
}

// ---------- Schermen ----------
function authView() {
  let mode = "register";
  const err = el("p", { class: "error", role: "alert" });
  const form = el("form", { class: "panel" });
  const friend = invitedBy();
  const render = () => {
    put(
      form,
      "replaceChildren",
      friend && mode === "register" ? el("div", { class: "invite-banner" }, "🎁 ", el("b", {}, friend), " nodigt je uit! Maak een account en krijg er een extra ei bij.") : null,
      el(
        "div",
        { class: "tabs" },
        el("button", { type: "button", class: `btn small ${mode === "register" ? "" : "ghost"}`, onclick: () => ((mode = "register"), render()) }, "Nieuw account"),
        el("button", { type: "button", class: `btn small ${mode === "login" ? "" : "ghost"}`, onclick: () => ((mode = "login"), render()) }, "Inloggen")
      ),
      ...(mode === "register"
        ? [
            el("label", { for: "u" }, "Gebruikersnaam ", el("span", { class: "muted small" }, "(zichtbaar op de ranglijst)")),
            el("input", { id: "u", name: "username", autocomplete: "username", required: true, maxlength: 20, pattern: "[A-Za-z0-9_]{3,20}" }),
            el("label", { for: "e" }, "E-mailadres"),
            el("input", { id: "e", name: "email", type: "email", autocomplete: "email", required: true, maxlength: 254 }),
          ]
        : [el("label", { for: "u" }, "E-mail of gebruikersnaam"), el("input", { id: "u", name: "login", autocomplete: "username", required: true, maxlength: 254 })]),
      el("label", { for: "p" }, "Wachtwoord"),
      el("input", { id: "p", name: "password", type: "password", autocomplete: mode === "login" ? "current-password" : "new-password", required: true, minlength: 8 }),
      mode === "login" ? el("p", { class: "small" }, el("a", { href: "#/vergeten" }, "Wachtwoord vergeten?")) : null,
      mode === "register" ? el("input", { name: "website", class: "hp", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" }) : null,
      mode === "register" ? el("label", { class: "check" }, el("input", { type: "checkbox", name: "adult", required: true }), "Ik ben 18 jaar of ouder, snap dat kaarten geen geldwaarde hebben en ga akkoord met de ", el("a", { href: "#/voorwaarden", target: "_blank" }, "voorwaarden"), " en het ", el("a", { href: "#/privacy", target: "_blank" }, "privacybeleid"), ".") : null,
      err,
      el("button", { class: "btn", type: "submit" }, mode === "register" ? "Start met 2 gratis eieren" : "Inloggen")
    );
  };
  render();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    try {
      await api(
        mode === "register" ? "/api/register" : "/api/login",
        mode === "register"
          ? { username: d.get("username"), email: d.get("email"), password: d.get("password"), adult: d.get("adult") === "on", website: d.get("website") || "", ref: friend || undefined }
          : { login: d.get("login"), password: d.get("password") }
      ).then((r) => {
        if (mode !== "register" || !friend) return;
        store.set(REF_KEY, null);
        if (r.invited) setTimeout(() => celebrate("+1 EI!", `Cadeautje van ${friend} 🎁`, "c-goud"), 400);
        else if (r.sameNetwork) toast("Welkom! De uitnodiging telt niet vanaf hetzelfde netwerk als je vriend.");
      });
      await refreshMe();
      location.hash = "#/";
      route();
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  const legend = catalog.cards.filter((c) => c.rarity === "icoon");
  const showcase = el(
    "div",
    { class: "showcase" },
    cardEl(legend[0], { variant: "holo" }),
    cardEl(legend[3], { variant: "kristal", serial: 1 }),
    cardEl(legend[4], { variant: "prisma" })
  );
  return el(
    "div",
    { class: "grid2" },
    el(
      "div",
      {},
      feedBar(),
      el("h1", {}, "Vang ze allemaal"),
      el("p", { class: "muted" }, `${catalog.cards.length} dino's uit ${catalog.groups.length} rijken. Broed elke dag gratis eieren uit, versteen dubbele kaarten tot fossielen en maak de dino die je mist. Jaag op Holo, Goudfolie, Prisma en de genummerde Oerkristal-kaarten: daarvan bestaan er maar ${catalog.kristalCap} per dino in de héle wereld.`),
      showcase
    ),
    form
  );
}

function packsView() {
  const wrap = el("div", { class: "packs-hero" });
  const feed = feedBar();
  const render = () => {
    const { available, max, nextAt, bought, gold = 0 } = me.packs;
    const total = available + bought;
    const pack = el("div", { class: `pack${total ? "" : " empty"}`, role: "button", tabindex: 0, "aria-label": "Broed ei uit" }, el("span", {}, catalog.game, el("br"), `Seizoen ${catalog.season}`));
    // Gouden Ei: apart te openen als je er een hebt; anders een klein lokkertje naar de winkel.
    const goldPack = gold
      ? el("div", { class: "pack gold", role: "button", tabindex: 0, "aria-label": "Open een Gouden Ei" }, el("span", {}, "Gouden", el("br"), "Ei"), el("b", { class: "gcount" }, `×${gold}`))
      : el("a", { class: "pack gold teaser", href: "#/winkel", "aria-label": "Gouden Eieren in de winkel" }, el("span", {}, "Gouden", el("br"), "Ei"));
    const countdown = el("p", { class: "muted" });
    const tickTimer = () => {
      if (!nextAt) return (countdown.textContent = `Je eieren zijn vol (${max}/${max}). Broed ze uit!`);
      const left = nextAt - Date.now();
      if (left <= 0) return refreshMe().then(render);
      countdown.textContent = `Volgend gratis ei over ${fmtTime(left)}`;
    };
    tickTimer();
    clearInterval(packsView.timer);
    packsView.timer = setInterval(tickTimer, 30000);
    const open = (egg, type) => async () => {
      const have = type === "goud" ? me.packs.gold : me.packs.available + me.packs.bought;
      if (!have || wrap.querySelector(".pack.busy")) return;
      egg.classList.add("busy");
      startShake(egg);
      try {
        const before = { ...me.collection };
        const { cards } = await api("/api/packs/open", type === "goud" ? { type } : {});
        await refreshMe();
        await hatch(egg, bestTier(cards, parseKey));
        showReveal(cards, before);
      } catch (ex) {
        toast(ex.message);
        egg.classList.remove("busy", "shake", "shake-hard");
      }
    };
    for (const [egg, type] of [[pack, "normaal"], ...(gold ? [[goldPack, "goud"]] : [])]) {
      egg.addEventListener("click", open(egg, type));
      egg.addEventListener("keydown", (e) => e.key === "Enter" && open(egg, type)());
    }
    put(
      wrap,
      "replaceChildren",
      feed,
      emailBanner(),
      el("h1", {}, total + gold ? `${total + gold} ${total + gold > 1 ? "eieren" : "ei"} klaar` : "Even geduld…"),
      dailyBar(),
      bought ? el("p", { class: "muted" }, `${available} gratis + ${bought} extra. Gratis eieren worden eerst uitgebroed.`) : null,
      el("p", { class: "muted" }, "Tik op het ei om het uit te broeden. Gloeit een kaart al op de achterkant? Dan zit er iets bijzonders in…"),
      el(
        "div",
        { class: `egg-row${gold ? " has-gold" : ""}` },
        el("div", { class: "egg-slot" }, pack, el("small", {}, "Gewoon ei")),
        el("div", { class: "egg-slot" }, goldPack, el("small", { class: "gold-label" }, gold ? "Gouden Ei · 5× kans op Legendarisch" : "✨ Gouden Ei: 5× kans →"))
      ),
      countdown,
      el("p", { class: "muted" }, `Verzamelwaarde: `, el("b", {}, `${me.value.toLocaleString("nl-NL")} punten`)),
      pityMeter(),
      total ? el("p", {}, el("a", { href: "#/winkel" }, me.starterAvailable && catalog.products.starter ? `🎁 Eenmalig: ${catalog.products.starter.eggs} eieren voor ${euro(catalog.products.starter.price)} →` : "Meer eieren of de Seizoenspas →")) : outOfEggsOffer(),
      questsPanel(),
      installPanel(),
      inviteBox()
    );
  };

  const showReveal = (cards, before) => {
    const seen = { ...before };
    const row = el(
      "div",
      { class: "reveal" },
      cards.map(({ key, serial }) => {
        const { card, variant } = parseKey(key);
        const isNew = !seen[key];
        seen[key] = (seen[key] || 0) + 1;
        const hint = variant !== "normaal" ? `hint-${variant}` : card.rarity === "icoon" ? "hint-icoon" : "";
        const f = el("div", { class: `flip ${hint}`, tabindex: 0 }, el("div", { class: "back" }, el("span", {}, "🦖")), el("div", { class: "front" }, cardEl(card, { variant, serial })), isNew ? el("span", { class: "newtag" }, "NIEUW") : null);
        const flip = () => {
          if (f.classList.contains("open")) return;
          f.classList.add("open");
          if (variant === "kristal") celebrate("OERKRISTAL!", `${card.name} · #${String(serial).padStart(2, "0")}/${catalog.kristalCap}`, "c-kristal");
          else if (variant === "prisma") celebrate("PRISMA!", card.name, "c-prisma");
          else if (variant === "goud") celebrate("GOUDFOLIE!", card.name, "c-goud");
          else if (card.rarity === "icoon") celebrate("LEGENDARISCH!", card.name, "c-icoon");
        };
        f.addEventListener("click", flip);
        f.addEventListener("keydown", (e) => e.key === "Enter" && flip());
        f.flip = flip;
        return f;
      })
    );
    wrap.replaceChildren(
      el("h1", {}, "Wat zit erin?"),
      el("p", { class: "muted" }, "Tik op de kaarten om ze om te draaien. Beweeg over een kaart om hem te laten glimmen."),
      row,
      el(
        "p",
        {},
        el("button", { class: "btn ghost", onclick: () => [...row.querySelectorAll(".flip")].forEach((f, i) => setTimeout(f.flip, i * 260)) }, "Alles omdraaien"),
        " ",
        el("button", { class: "btn ghost", onclick: () => {
            const order = { kristal: 0, prisma: 1, goud: 2, holo: 3, normaal: 4 };
            const rank = { icoon: 0, goud: 1, zilver: 2, brons: 3 };
            const best = cards.map(({ key, serial }) => ({ ...parseKey(key), serial })).sort((a, b) => order[a.variant] - order[b.variant] || rank[a.card.rarity] - rank[b.card.rarity] || b.card.rating - a.card.rating)[0];
            row.querySelectorAll(".flip").forEach((f) => f.flip());
            showShare(best.card, best.variant, best.serial);
          } }, "📲 Deel je beste kaart"),
        " ",
        el("button", { class: "btn", onclick: render }, "Verder")
      )
    );
    deal([...row.querySelectorAll(".flip")]);
  };

  render();
  return wrap;
}

function albumView() {
  let filter = "alle";
  const ownedCards = catalog.cards.filter((c) => totalOwned(c.id));
  const body = el("div");
  const matches = (c) => {
    if (filter === "alle") return true;
    if (filter === "dubbel") return ownedVariants(c.id).some((v) => v !== "kristal" && me.collection[keyOf(c.id, v)] > 1);
    if (filter === "mist") return !totalOwned(c.id);
    if (filter === "glans") return ownedVariants(c.id).some((v) => v !== "normaal");
    return c.rarity === filter;
  };
  const render = () => {
    body.replaceChildren(
      ...catalog.groups.map((realm) => {
        const cards = catalog.cards.filter((c) => c.group === realm.id && matches(c));
        if (!cards.length) return "";
        const have = catalog.cards.filter((c) => c.group === realm.id && totalOwned(c.id)).length;
        const dot = el("span", { class: "dot" });
        dot.style.background = realm.colors[0];
        return el(
          "section",
          { class: "club-row" },
          el("h3", {}, dot, realm.name, el("span", { class: "muted" }, ` ${have}/16`)),
          el(
            "div",
            { class: "cards" },
            cards.map((c) => {
              const variants = ownedVariants(c.id);
              if (!variants.length) {
                const node = cardEl(c, { missing: true });
                node.addEventListener("click", () => showCraft(c));
                return node;
              }
              const best = variants[0];
              const node = cardEl(c, { variant: best, count: totalOwned(c.id), serial: best === "kristal" ? serialsOf(c.id)[0] : null, chips: variants });
              node.addEventListener("click", () => showDetail(c));
              return node;
            })
          )
        );
      })
    );
  };
  const filters = el(
    "div",
    { class: "filters" },
    [["alle", "Alles"], ["glans", "✨ Holo en hoger"], ["dubbel", "Dubbel"], ["mist", "Mis ik nog"], ...Object.entries(catalog.rarities).map(([k, v]) => [k, v.label])].map(([k, label]) => {
      const b = el("button", { class: k === filter ? "on" : "", onclick: () => ((filter = k), filters.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)), render()) }, label);
      return b;
    })
  );
  render();
  const pct = Math.round((ownedCards.length / catalog.cards.length) * 100);
  const bar = el("div", { class: "progress" }, el("i"));
  bar.firstChild.style.width = `${pct}%`;
  const special = Object.entries(me.collection).filter(([k]) => k.includes(":")).reduce((n, [, c]) => n + c, 0);
  return el(
    "div",
    {},
    el("h1", {}, "Mijn album"),
    goalsPanel(),
    el("p", { class: "muted" }, `${ownedCards.length} van de ${catalog.cards.length} dino's (${pct}%) · ${special} glanskaarten · ${me.packsOpened} eieren uitgebroed · verzamelwaarde `, el("b", {}, `${me.value.toLocaleString("nl-NL")} punten`)),
    bar,
    filters,
    body
  );
}

function forgotView() {
  const msg = el("p", { class: "muted", role: "status" });
  const input = el("input", { type: "email", name: "email", required: true, autocomplete: "email", placeholder: "jij@voorbeeld.nl" });
  const btn = el("button", { class: "btn", type: "submit" }, "Stuur resetlink");
  const form = el("form", { class: "panel narrow" }, el("h1", {}, "Wachtwoord vergeten"), el("p", { class: "muted" }, "Vul het e-mailadres van je account in. We sturen je een link om een nieuw wachtwoord in te stellen."), el("label", {}, "E-mailadres"), input, btn, msg, el("p", { class: "small" }, el("a", { href: "#/" }, "← Terug naar inloggen")));
  // Zolang er geen mail verstuurd kan worden (RESEND_API_KEY niet ingesteld): eerlijk zeggen in plaats van niets sturen.
  if (catalog.mail === false) {
    input.disabled = btn.disabled = true;
    msg.textContent = "Wachtwoord herstellen per e-mail is binnenkort beschikbaar. Weet je je gebruikersnaam of e-mailadres nog? Probeer dan opnieuw in te loggen.";
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const { message } = await api("/api/password/forgot", { email: input.value });
      msg.textContent = `${message} Kijk ook in je spam.`;
    } catch (ex) {
      msg.textContent = ex.message;
      btn.disabled = false;
    }
  });
  return form;
}

function resetView(params) {
  const token = params.get("token") || "";
  const err = el("p", { class: "error", role: "alert" });
  const p1 = el("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password" });
  const p2 = el("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password" });
  const form = el("form", { class: "panel narrow" }, el("h1", {}, "Nieuw wachtwoord"), el("label", {}, "Nieuw wachtwoord (minstens 8 tekens)"), p1, el("label", {}, "Nog een keer"), p2, err, el("button", { class: "btn", type: "submit" }, "Opslaan en inloggen"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (p1.value !== p2.value) return (err.textContent = "De wachtwoorden zijn niet hetzelfde.");
    try {
      await api("/api/password/reset", { token, password: p1.value });
      await refreshMe();
      toast("Wachtwoord gewijzigd. Je bent ingelogd!");
      location.hash = "#/";
    } catch (ex) {
      err.textContent = ex.message;
    }
  });
  return form;
}

async function leaderboardView() {
  const { top, mine } = await api("/api/leaderboard");
  const medal = (r) => ["🥇", "🥈", "🥉"][r - 1] || `#${r}`;
  const rows = top.map((r) =>
    el(
      "tr",
      { class: mine && r.username === mine.username ? "me" : "" },
      el("td", { class: "rank" }, medal(r.rank)),
      el("td", {}, el("b", {}, r.username), r.realms ? el("span", { class: "badges", title: "Complete rijken" }, ` ${realmBadges(r.realms)}`) : null),
      el("td", { class: "num" }, `${r.score.toLocaleString("nl-NL")} pt`),
      el("td", { class: "num muted" }, `${r.eggs} 🥚`)
    )
  );
  const inTop = mine && top.some((r) => r.username === mine.username);
  return el(
    "div",
    {},
    el("h1", {}, "Ranglijst"),
    el("p", { class: "muted" }, "De verzamelaars met de hoogste verzamelwaarde. Zeldzame dino's en glanskaarten tellen veel zwaarder: een Legendarische Oerkristal is 10.000 punten waard."),
    mine ? el("div", { class: "panel myrank" }, el("span", {}, "Jouw plek"), el("b", {}, `#${mine.rank}`), el("span", {}, `${mine.score.toLocaleString("nl-NL")} punten`)) : el("p", {}, el("a", { href: "#/" }, "Maak een account en doe mee →")),
    el("br"),
    top.length
      ? el("div", { class: "panel" }, el("table", { class: "board" }, el("tr", {}, el("th", {}, ""), el("th", {}, "Verzamelaar"), el("th", { class: "num" }, "Waarde"), el("th", { class: "num" }, "Eieren")), rows))
      : el("p", { class: "muted" }, "Nog niemand op de ranglijst. Broed een ei uit en sta bovenaan!"),
    mine && !inTop && top.length ? el("p", { class: "muted" }, `Jij staat op plek ${mine.rank}. Nog ${(top[top.length - 1].score - mine.score + 1).toLocaleString("nl-NL")} punten tot de top ${top.length}.`) : null
  );
}

// Voor accounts van vóór de e-mail: adres toevoegen zodat wachtwoord vergeten werkt.
function emailBanner() {
  if (me.email) return null;
  const email = el("input", { type: "email", placeholder: "jij@voorbeeld.nl", required: true });
  const pw = el("input", { type: "password", placeholder: "Je huidige wachtwoord", required: true });
  const form = el("form", { class: "panel banner" }, el("b", {}, "📧 Voeg je e-mailadres toe"), el("span", { class: "muted small" }, "Dan kun je inloggen met je e-mail en je wachtwoord herstellen als je het vergeet."), el("div", { class: "row" }, email, pw, el("button", { class: "btn small", type: "submit" }, "Opslaan")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/account/email", { email: email.value, password: pw.value });
      await refreshMe();
      toast("E-mailadres opgeslagen ✓");
      form.remove();
    } catch (ex) {
      toast(ex.message);
    }
  });
  return form;
}

function fossilsView() {
  const dupes = Object.entries(me.collection).filter(([key, n]) => n > 1 && !key.endsWith(":kristal"));
  const gain = dupes.reduce((sum, [key, n]) => {
    const { card, variant } = parseKey(key);
    return sum + dustOf(card, variant) * (n - 1);
  }, 0);
  const btn = el("button", { class: "btn", disabled: !gain }, gain ? `Versteen alle dubbele (+${gain.toLocaleString("nl-NL")} 🦴)` : "Geen dubbele kaarten");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const before = me.fossils;
      const { gained } = await api("/api/fossils/dust-dupes", {});
      await bonesToBank(btn, gained, before);
      await refreshMe();
      toast(`+${gained.toLocaleString("nl-NL")} 🦴 fossielen`);
      route();
    } catch (ex) {
      toast(ex.message);
      btn.disabled = false;
    }
  });
  const missing = catalog.cards.filter((c) => !totalOwned(c.id));
  const row = (title, list) =>
    list.length
      ? el(
          "section",
          { class: "club-row" },
          el("h3", {}, title),
          el(
            "div",
            { class: "cards" },
            list.map((c) => {
              const node = cardEl(c, { missing: true });
              node.addEventListener("click", () => showCraft(c));
              return node;
            })
          )
        )
      : null;
  const f = catalog.fossils;
  const t = (obj) => Object.keys(catalog.rarities).map((r) => el("td", {}, String(obj[r])));
  return el(
    "div",
    {},
    el("h1", {}, "Fossielen"),
    el("p", { class: "muted" }, "Versteen kaarten die je niet nodig hebt tot 🦴 fossielen en maak daarmee precies de dino die je zoekt. Fossielen gebruik je alleen hiervoor: je kunt er geen eieren mee kopen, ze niet overdragen en niet uitbetalen."),
    el(
      "div",
      { class: "panel fossil-bank" },
      el("div", {}, el("div", { class: "muted" }, "Jouw fossielen"), el("div", { class: "price" }, `${me.fossils.toLocaleString("nl-NL")} 🦴`)),
      el("div", {}, btn, el("p", { class: "muted small" }, "Je houdt van elke versie altijd één exemplaar. Oerkristal wordt nooit versteend."))
    ),
    el("br"),
    el(
      "div",
      { class: "panel" },
      el("h2", {}, "Wat levert het op, wat kost het?"),
      el(
        "table",
        { class: "odds" },
        el("tr", {}, el("th", {}), Object.values(catalog.rarities).map((r) => el("th", {}, r.label))),
        el("tr", {}, el("td", {}, "Verstenen (Normaal)"), t(f.dust)),
        el("tr", {}, el("td", {}, "Maken (Normaal)"), t(f.craft)),
        el("tr", {}, el("td", {}, "Maken (Holo)"), t(Object.fromEntries(Object.entries(f.craft).map(([k, v]) => [k, v * f.craftMult.holo]))))
      ),
      el("p", { class: "muted" }, `Verstenen levert extra op voor Holo (×${f.dustMult.holo}), Goudfolie (×${f.dustMult.goud}) en Prisma (×${f.dustMult.prisma}). Goudfolie, Prisma en Oerkristal kun je niet maken: die vind je alleen in eieren.`)
    ),
    el("br"),
    row(`Mis ik nog (${missing.length}). Tik om te maken`, missing)
  );
}

async function shopView(params) {
  if (params.get("betaald")) {
    const { last } = await api("/api/checkout/verify", {});
    await refreshMe();
    toast(last?.status === "paid" ? `${catalog.products[last.product].label}: gelukt! 🎉` : "Betaling nog niet binnen. Probeer het zo opnieuw.");
    history.replaceState(null, "", "#/winkel");
  }
  const { products, rules } = catalog;
  // Digitale inhoud: vooraf instemmen met directe levering en afzien van de bedenktijd (wettelijk verplicht).
  const waiver = el("input", { type: "checkbox", id: "waiver" });
  const waiverBox = el(
    "label",
    { class: "panel check waiver", for: "waiver" },
    waiver,
    el("span", {}, "Ik wil mijn aankoop direct ontvangen en weet dat ik daardoor mijn herroepingsrecht (14 dagen bedenktijd) verlies. ", el("a", { href: "#/voorwaarden" }, "Voorwaarden"))
  );
  waiver.addEventListener("change", () => waiverBox.classList.remove("needs"));
  const buy = (id) => async (e) => {
    if (!waiver.checked) {
      waiverBox.classList.add("needs");
      waiverBox.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast("Vink eerst het vakje boven de producten aan.");
    }
    e.target.disabled = true;
    try {
      const { url } = await api("/api/checkout", { product: id, waiver: true });
      if (url.startsWith("/")) {
        location.hash = url.slice(1);
        route();
      } else location.href = url;
    } catch (ex) {
      toast(ex.message);
      e.target.disabled = false;
    }
  };
  // Prijs per ei van het kleinste pakket, om het voordeel van grotere pakketten te tonen.
  const eggs = Object.entries(products).filter(([, p]) => p.eggs && !p.once);
  const golds = Object.entries(products).filter(([, p]) => p.goldEggs);
  const g = catalog.odds.goudenEi;
  const times = (a, b) => `${Math.round(a / b)}×`;
  const base = Math.max(...eggs.map(([, p]) => p.price / p.eggs));
  const saving = (p) => Math.round((1 - p.price / p.eggs / base) * 100);
  const st = products.starter;
  const extraPerDay = 24 / (rules.premium.interval / 3600000) - 24 / (rules.free.interval / 3600000);
  return el(
    "div",
    {},
    el("h1", {}, "Winkel"),
    pityMeter(),
    me.starterAvailable && st
      ? el(
          "div",
          { class: "panel starter" },
          el("span", { class: "ptag" }, "🎁 Eenmalig aanbod"),
          el("div", { class: "eggs" }, "🥚".repeat(5), el("br"), "🥚".repeat(5)),
          el(
            "div",
            {},
            el("h2", {}, "Starterspakket"),
            el("p", {}, `${st.eggs} eieren voor maar `, el("b", { class: "sprice" }, euro(st.price)), " ", el("s", { class: "muted" }, euro(Math.round(base * st.eggs)))),
            el("p", { class: "muted small" }, `Slechts ${euro(Math.round(st.price / st.eggs))} per ei · alleen voor je eerste aankoop`),
            el("button", { class: "btn", onclick: buy("starter") }, `Pak ${st.eggs} eieren voor ${euro(st.price)}`)
          )
        )
      : null,
    waiverBox,
    el(
      "div",
      { class: "shop" },
      eggs.map(([id, p]) =>
        el(
          "div",
          { class: `panel product${p.tag ? " tagged" : ""}` },
          p.tag ? el("span", { class: "ptag" }, p.tag) : null,
          saving(p) > 0 ? el("span", { class: "psave" }, `Bespaar ${saving(p)}%`) : null,
          el("div", { class: "eggs" }, "🥚".repeat(Math.min(p.eggs, 5))),
          el("h2", {}, p.label),
          el("div", { class: "price" }, euro(p.price)),
          el("p", { class: "muted" }, `${euro(Math.round(p.price / p.eggs))} per ei`),
          el("button", { class: "btn", onclick: buy(id) }, "Kopen")
        )
      ),
      el(
        "div",
        { class: "panel product pass tagged" },
        el("span", { class: "ptag" }, "Meeste waarde"),
        el("div", { class: "eggs" }, "⏱️"),
        el("h2", {}, products.pass.label),
        el("div", { class: "price" }, euro(products.pass.price)),
        el(
          "ul",
          { class: "ticks" },
          el("li", {}, `Elke ${rules.premium.interval / 3600000} uur een gratis ei (in plaats van ${rules.free.interval / 3600000})`),
          el("li", {}, `Spaar tot ${rules.premium.max} gratis eieren op`),
          el("li", {}, el("b", {}, `≈ ${extraPerDay * products.pass.days} extra eieren`), ` in ${products.pass.days} dagen`)
        ),
        me.premiumUntil ? el("p", {}, `Actief tot ${new Date(me.premiumUntil).toLocaleDateString("nl-NL")}`) : null,
        el("button", { class: "btn", onclick: buy("pass") }, me.premiumUntil ? "Verlengen" : "Kopen")
      )
    ),
    golds.length && g
      ? el(
          "div",
          { class: "panel gold-shop" },
          el("h2", {}, "✨ Gouden Eieren"),
          el("p", {}, "Meer kans op de beste kaarten. In elk Gouden Ei zit minstens één ", el("b", {}, "Episch"), " of beter."),
          el(
            "div",
            { class: "gold-compare" },
            [
              ["Legendarisch", catalog.odds.perKaart.icoon, g.perKaart.icoon],
              ["Prisma", catalog.odds.afwerking.prisma, g.afwerking.prisma],
              ["Oerkristal", catalog.odds.afwerking.kristal, g.afwerking.kristal],
            ].map(([label, a, b]) => el("div", {}, el("b", {}, times(b, a)), el("span", {}, `kans op ${label}`)))
          ),
          el(
            "div",
            { class: "shop" },
            golds.map(([id, p]) =>
              el(
                "div",
                { class: `panel product goldp${p.tag ? " tagged" : ""}` },
                p.tag ? el("span", { class: "ptag" }, p.tag) : null,
                el("div", { class: "eggs" }, "🥚".repeat(Math.min(p.goldEggs, 5))),
                el("h2", {}, p.label),
                el("div", { class: "price" }, euro(p.price)),
                el("p", { class: "muted" }, `${euro(Math.round(p.price / p.goldEggs))} per Gouden Ei`),
                el("button", { class: "btn", onclick: buy(id) }, "Kopen")
              )
            )
          ),
          el("p", { class: "muted small" }, el("a", { href: "#/regels" }, "Bekijk alle kansen van gewone en Gouden Eieren →"))
        )
      : null,
    el(
      "div",
      { class: "panel" },
      el("h2", {}, "Eerlijk spel"),
      el(
        "ul",
        {},
        el("li", {}, "Gewone gekochte eieren hebben precies dezelfde kansen als gratis eieren. Gouden Eieren hebben betere kansen. ", el("a", { href: "#/regels" }, "Bekijk alle kansen.")),
        el("li", {}, `Geluksmeter: in uiterlijk elk ${rules.pity}e ei zit gegarandeerd een Legendarische kaart.`),
        el("li", {}, "Kaarten en fossielen hebben geen geldwaarde: je kunt ze niet verkopen, ruilen of uitbetalen, en met fossielen koop je geen eieren.")
      ),
      catalog.demoMode ? el("p", { class: "muted" }, "Testmodus: er wordt niets afgeschreven.") : el("p", { class: "muted" }, "Betalen met iDEAL, Bancontact of creditcard via Mollie.")
    )
  );
}

// Geluksmeter: hoe ver je bent tot de gegarandeerde Legendarische kaart.
function pityMeter() {
  if (!me.pity) return null;
  const { left, of } = me.pity;
  return el(
    "div",
    { class: "pity" },
    el("div", { class: "pity-top" }, el("b", {}, "⭐ Geluksmeter"), el("span", {}, left === 1 ? "Volgende ei: gegarandeerd Legendarisch!" : `Legendarisch gegarandeerd binnen ${left} eieren`)),
    el("div", { class: "qbar pity-bar" }, el("i", { style: `width:${Math.round(((of - left) / of) * 100)}%` }))
  );
}

// Aanbieding als je geen eieren meer hebt.
function outOfEggsOffer() {
  const { products } = catalog;
  const starter = me.starterAvailable && products.starter;
  return el(
    "div",
    { class: "panel offer" },
    el("b", {}, "Niet wachten?"),
    el("span", { class: "muted" }, starter ? `Eenmalig: ${starter.eggs} eieren voor ${euro(starter.price)}` : `${products.eieren12.label} voor ${euro(products.eieren12.price)}, of de Seizoenspas voor sneller gratis eieren`),
    el("a", { class: "btn small", href: "#/winkel" }, starter ? "Pak het aanbod" : "Naar de winkel")
  );
}

// ---------- Opdrachten, verzameldoelen, live-balk ----------
const euro = (c) => `€${(c / 100).toFixed(2).replace(".", ",")}`;
const REALM_ICON = { vuur: "🌋", ijs: "❄️", jungle: "🌿", oceaan: "🌊", storm: "⚡", schaduw: "🌑" };
const realmBadges = (mask) => catalog.groups.filter((_, i) => mask & (1 << i)).map((g) => REALM_ICON[g.id] || "🏅").join("");
const rewardText = (r) => [r.eggs ? `${r.eggs} 🥚` : null, r.fossils ? `${r.fossils} 🦴` : null].filter(Boolean).join(" + ");

// Beloning ophalen met animatie: botjes naar de teller, of een feestje bij eieren.
async function claimReward(path, body, btn, title) {
  btn.disabled = true;
  const before = me.fossils;
  try {
    const r = await api(path, body);
    if (r.eggs) celebrate(`+${r.eggs} ${r.eggs === 1 ? "EI" : "EIEREN"}!`, title, "c-goud");
    if (r.fossils) await bonesToBank(btn, r.fossils, before);
    await refreshMe();
    setTimeout(() => route(true), r.eggs ? 900 : 0);
  } catch (ex) {
    toast(ex.message);
    btn.disabled = false;
  }
}

function questsPanel() {
  const { list, bonus } = me.quests || {};
  if (!list) return null;
  const row = (label, progress, target, reward, done, claimed, onClaim) =>
    el(
      "div",
      { class: `quest${claimed ? " claimed" : done ? " ready" : ""}` },
      el("div", { class: "qtext" }, el("b", {}, label), el("div", { class: "qbar" }, el("i", { style: `width:${Math.round((progress / target) * 100)}%` })), el("small", {}, `${progress}/${target} · ${reward}`)),
      claimed ? el("span", { class: "qdone" }, "✓") : done ? el("button", { class: "btn small", onclick: (e) => onClaim(e.currentTarget) }, "Ophalen") : null
    );
  const done = list.filter((q) => q.claimed).length;
  return el(
    "div",
    { class: "panel quests" },
    el("h2", {}, "🎯 Opdrachten van vandaag"),
    list.map((q) => row(q.label, q.progress, q.target, `${q.fossils} 🦴`, q.progress >= q.target, q.claimed, (b) => claimReward("/api/quests/claim", { id: q.id }, b, "Opdracht voltooid"))),
    row(`Bonus: alle 3 opdrachten`, done, 3, `${bonus.eggs} 🥚`, bonus.ready, bonus.claimed, (b) => claimReward("/api/quests/claim", { id: "bonus" }, b, "Alle opdrachten gehaald 🎯")),
    el("p", { class: "muted small" }, "Elke nacht om 00:00 komen er nieuwe opdrachten.")
  );
}

function goalsPanel() {
  const g = me.goals;
  if (!g) return null;
  const total = catalog.cards.length;
  const next = g.counts.find((c) => !c.claimed && g.unique < c.count);
  const milestones = el(
    "div",
    { class: "milestones" },
    g.counts.map((c, i) => {
      const ready = g.unique >= c.count && !c.claimed;
      return el(
        "div",
        { class: `mstone${c.claimed ? " claimed" : ready ? " ready" : ""}` },
        el("b", {}, `${c.count}`),
        el("small", {}, rewardText(c)),
        c.claimed ? el("span", { class: "qdone" }, "✓") : ready ? el("button", { class: "btn small", onclick: (e) => claimReward("/api/goals/claim", { type: "count", index: i }, e.currentTarget, `${c.count} dino's verzameld`) }, "Ophalen") : null
      );
    })
  );
  const realms = el(
    "div",
    { class: "realm-goals" },
    g.realms.map((r, i) => {
      const realm = catalog.groups[i];
      const ready = r.have >= r.total && !r.claimed;
      return el(
        "div",
        { class: `rgoal${r.claimed ? " claimed" : ready ? " ready" : ""}` },
        el("span", { class: "ricon" }, REALM_ICON[r.id] || "🏅"),
        el("div", { class: "qtext" }, el("b", {}, realm.name), el("div", { class: "qbar" }, el("i", { style: `width:${Math.round((r.have / r.total) * 100)}%;background:linear-gradient(90deg,${realm.colors[0]},${realm.colors[1]})` })), el("small", {}, `${r.have}/${r.total} · compleet: ${rewardText(catalog.rules.realmReward)} + badge`)),
        r.claimed ? el("span", { class: "qdone" }, "✓") : ready ? el("button", { class: "btn small", onclick: (e) => claimReward("/api/goals/claim", { type: "realm", index: i }, e.currentTarget, `${realm.name} compleet! ${REALM_ICON[r.id]}`) }, "Ophalen") : null
      );
    })
  );
  return el(
    "details",
    { class: "panel goals", open: g.counts.some((c) => !c.claimed && g.unique >= c.count) || g.realms.some((r) => !r.claimed && r.have >= r.total) || null },
    el("summary", {}, el("h2", {}, "🏆 Verzameldoelen"), el("span", { class: "muted small" }, next ? `Nog ${next.count - g.unique} tot ${rewardText(next)}` : `${g.unique}/${total}`)),
    milestones,
    el("p", { class: "muted small" }, "Maak een rijk compleet voor 2 eieren en een badge naast je naam op de ranglijst."),
    realms
  );
}

// Live-balk met bijzondere vondsten van andere spelers.
function feedBar() {
  const bar = el("div", { class: "feed", hidden: true });
  api("/api/feed")
    .then(({ items }) => {
      if (!items.length) return;
      const ago = (t) => {
        const m = Math.round((Date.now() - t) / 60000);
        return m < 1 ? "net" : m < 60 ? `${m} min geleden` : m < 1440 ? `${Math.round(m / 60)} uur geleden` : `${Math.round(m / 1440)} d geleden`;
      };
      const entries = items.map((it) => {
        const p = parseKey(it.key);
        if (!p) return null;
        const v = p.variant !== "normaal" ? `${catalog.variants[p.variant].label} ` : "";
        return el("span", { class: `fitem v-${p.variant}` }, "✨ ", el("b", {}, it.user), ` vond ${v}`, el("b", {}, p.card.name), it.serial ? ` #${String(it.serial).padStart(2, "0")}` : "", el("small", {}, ` · ${ago(it.at)}`));
      }).filter(Boolean);
      const track = el("div", { class: "ftrack" }, entries, entries.map((e) => e.cloneNode(true)));
      track.style.animationDuration = `${Math.max(20, entries.length * 6)}s`;
      bar.replaceChildren(el("span", { class: "flabel" }, "📣 LIVE"), el("div", { class: "fwin" }, track));
      bar.hidden = false;
    })
    .catch(() => {});
  return bar;
}

// Bolletje in het menu als er een beloning klaarligt.
function updateNavDots() {
  const set = (href, on) => nav.querySelector(`a[href="${href}"]`)?.classList.toggle("dot", !!on);
  if (!me) return;
  const q = me.quests;
  set("#/", q && (q.list.some((x) => !x.claimed && x.progress >= x.target) || (q.bonus.ready && !q.bonus.claimed)));
  const g = me.goals;
  set("#/album", g && (g.counts.some((c) => !c.claimed && g.unique >= c.count) || g.realms.some((r) => !r.claimed && r.have >= r.total)));
}

// ---------- Op het beginscherm zetten (app) ----------
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// force: ook tonen als de speler hem eerder wegklikte (op Mijn account).
function installPanel(force = false) {
  if (isStandalone() || (!force && store.get("dinorijk-install-weg"))) return null;
  if (!installPrompt && !isIOS() && !force) return null;
  const box = el("div", { class: "panel install" });
  const how = isIOS()
    ? el("small", { class: "muted" }, "Tik onderin Safari op ", el("b", {}, "Deel"), " (vierkantje met pijl) en kies ", el("b", {}, "Zet op beginscherm"), ".")
    : installPrompt
      ? el("button", { class: "btn small", onclick: async () => { await installPrompt.prompt(); installPrompt = null; box.remove(); } }, "Installeren")
      : el("small", { class: "muted" }, "Open het browsermenu (⋮) en kies ", el("b", {}, "App installeren"), " of ", el("b", {}, "Toevoegen aan startscherm"), ".");
  box.append(
    el("img", { src: "/icons/icon-192.png", alt: "" }),
    el("div", { class: "itext" }, el("b", {}, "📲 Zet DinoRijk op je beginscherm"), el("small", { class: "muted" }, "Dan open je het als een app, met één tik."), how),
    force ? "" : el("button", { class: "x", "aria-label": "Sluiten", onclick: () => (store.set("dinorijk-install-weg", "1"), box.remove()) }, "×")
  );
  return box;
}

// Dagelijkse beloning: reeks op de eierenpagina en het venster met 7 dagen.
function dailyBar() {
  const { streak, claimedToday } = me.daily || {};
  if (!me.daily) return null;
  return el(
    "p",
    { class: "streak" },
    streak ? el("span", { class: "flame" }, `🔥 ${streak} ${streak === 1 ? "dag" : "dagen"} op rij`) : null,
    claimedToday ? null : el("button", { class: "btn small", onclick: showDaily }, "🎁 Dagbeloning ophalen")
  );
}

// Eén keer per dag vanzelf tonen; ook na herladen of opnieuw openen niet nog eens.
const DAILY_KEY = "dinorijk-dagvenster";
const dailyShownToday = () => store.get(DAILY_KEY) === new Date().toDateString();
function showDaily() {
  if (!me?.daily || me.daily.claimedToday || document.querySelector(".overlay.daily")) return;
  store.set(DAILY_KEY, new Date().toDateString());
  const { nextDay } = me.daily;
  const rewards = catalog.rules.daily;
  const tiles = rewards.map((r, i) => {
    const n = i + 1;
    return el(
      "div",
      { class: `dtile${n < nextDay ? " done" : ""}${n === nextDay ? " today" : ""}${r.eggs ? " seven" : ""}` },
      el("small", {}, `Dag ${n}`),
      el("div", { class: "dicon" }, r.eggs ? "🥚".repeat(r.eggs) : "🦴"),
      el("b", {}, r.eggs ? `${r.eggs} eieren` : `+${r.fossils}`),
      n < nextDay ? el("span", { class: "check" }, "✓") : null
    );
  });
  const close = () => overlay.remove();
  const claim = el("button", { class: "btn" }, "Ophalen");
  claim.addEventListener("click", async () => {
    claim.disabled = true;
    const before = me.fossils;
    try {
      const { day, reward } = await api("/api/daily", {});
      const tile = tiles[day - 1];
      tile.classList.add("claimed", "done");
      if (reward.eggs) celebrate(`${reward.eggs} EIEREN!`, "7 dagen op rij 🔥", "c-goud");
      else await bonesToBank(tile, reward.fossils, before);
      await refreshMe();
      setTimeout(() => (close(), route()), reward.eggs ? 1600 : 300);
    } catch (ex) {
      toast(ex.message);
      close();
    }
  });
  const overlay = el(
    "div",
    { class: "overlay daily", onclick: (e) => e.target === overlay && close() },
    el(
      "div",
      { class: "detail daily-box" },
      el("h2", {}, "🎁 Dagelijkse beloning"),
      el("p", { class: "muted" }, `Kom elke dag terug! Op dag 7 krijg je ${rewards[6].eggs} gratis eieren. Mis je een dag, dan begin je weer bij dag 1.`),
      el("div", { class: "daily-grid" }, tiles),
      el("p", {}, claim, " ", el("button", { class: "btn ghost", onclick: close }, "Later"))
    )
  );
  document.body.append(overlay);
}

// Je eigen uitnodigingslink, met delen/kopiëren en hoeveel vrienden er meededen.
function inviteBox() {
  const link = `${location.origin}/?vriend=${encodeURIComponent(me.username)}`;
  const text = `Doe mee met DinoRijk en verzamel echte dino-kaarten! Via mijn link krijg je een extra ei 🥚🦖`;
  const input = el("input", { value: link, readonly: true, onclick: (e) => e.target.select(), "aria-label": "Jouw uitnodigingslink" });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link gekopieerd! Stuur hem naar je vrienden.");
    } catch {
      input.select();
      toast("Selecteer en kopieer de link hierboven.");
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "DinoRijk", text, url: link });
    } catch (ex) {
      if (ex?.name !== "AbortError") copy();
    }
  };
  const { joined, waiting } = me.invite || { joined: 0, waiting: 0 };
  return el(
    "div",
    { class: "panel invite" },
    el("h2", {}, "🎁 Nodig vrienden uit"),
    el("p", { class: "muted" }, `Maakt een vriend via jouw link een account, dan krijgt die meteen een extra ei. Zodra die het eerste ei uitbroedt, krijg jij er ook één (maximaal ${catalog.rules.referralsPer30d} per 30 dagen).`),
    el("div", { class: "invite-row" }, input, navigator.share ? el("button", { class: "btn small", onclick: share }, "📲 Delen") : null, el("button", { class: `btn small${navigator.share ? " ghost" : ""}`, onclick: copy }, "Kopieer")),
    joined || waiting ? el("p", { class: "small" }, `${joined} ${joined === 1 ? "vriend deed" : "vrienden deden"} mee`, waiting ? ` · ${waiting} ${waiting === 1 ? "wacht" : "wachten"} nog op het eerste ei` : "") : null
  );
}

// Een vriend broedde zijn eerste ei uit: feestje (één keer per nieuwe vriend).
function checkInviteReward() {
  if (!me?.invite) return;
  const key = `dinorijk-vrienden-${me.username}`;
  const seen = Number(store.get(key));
  const now = me.invite.joined;
  if (store.get(key) != null && now > seen) celebrate(`+${now - seen} EI!`, now - seen === 1 ? "Een vriend deed mee 🎁" : `${now - seen} vrienden deden mee 🎁`, "c-goud");
  store.set(key, String(now));
}

function accountView() {
  const pw = el("input", { type: "password", required: true, autocomplete: "current-password", placeholder: "Je wachtwoord" });
  const sure = el("input", { type: "checkbox", required: true });
  const del = el(
    "form",
    { class: "panel danger" },
    el("h2", {}, "Account verwijderen"),
    el("p", { class: "muted" }, "Je gebruikersnaam, e-mailadres, wachtwoord, kaarten, fossielen en ongebruikte eieren worden direct en definitief gewist. Dit kan niet ongedaan worden gemaakt. Betaalgegevens bewaren we zonder je naam, omdat de wet dat verplicht."),
    pw,
    el("label", { class: "check" }, sure, "Ja, ik wil mijn account en al mijn kaarten definitief verwijderen."),
    el("button", { class: "btn danger", type: "submit" }, "Account verwijderen")
  );
  del.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!confirm("Weet je het zeker? Al je kaarten zijn daarna voorgoed weg.")) return;
    try {
      await api("/api/account/delete", { password: pw.value });
      me = null;
      await refreshMe();
      location.hash = "#/";
      toast("Je account is verwijderd. Bedankt voor het spelen!");
    } catch (ex) {
      toast(ex.message);
    }
  });
  return el(
    "div",
    { class: "account" },
    el("h1", {}, "Mijn account"),
    el(
      "div",
      { class: "panel" },
      el("p", {}, "Gebruikersnaam: ", el("b", {}, me.username)),
      el("p", {}, "E-mailadres: ", el("b", {}, me.email || "nog niet ingesteld")),
      me.premiumUntil ? el("p", {}, `Seizoenspas actief tot ${new Date(me.premiumUntil).toLocaleDateString("nl-NL")}`) : null,
      el("p", {}, el("a", { class: "btn ghost small", href: "/api/account/export", download: "" }, "⬇️ Download mijn gegevens")),
      el("p", { class: "muted small" }, "Lees hoe we met je gegevens omgaan in het ", el("a", { href: "#/privacy" }, "privacybeleid"), ".")
    ),
    emailBanner(),
    el("br"),
    inviteBox(),
    installPanel(true),
    el("br"),
    del
  );
}

function rulesView() {
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const { perKaart, laatsteKaart, afwerking, goudenEi: g } = catalog.odds;
  return el(
    "div",
    { class: "panel" },
    el("h1", {}, "Kansen & regels"),
    el("p", {}, "Een ei bevat 5 kaarten. Elke kaart krijgt eerst een zeldzaamheid en daarna, los daarvan, een afwerking. Gratis eieren en gewone gekochte eieren hebben precies dezelfde kansen. Het ✨ Gouden Ei (alleen te koop) heeft betere kansen; die staan ernaast."),
    el("h2", {}, "Zeldzaamheid"),
    el(
      "table",
      { class: "odds" },
      el("tr", {}, el("th", {}, "Zeldzaamheid"), el("th", {}, "Kaart 1–4"), el("th", {}, "Kaart 5"), el("th", { class: "gold-col" }, "Gouden Ei 1–4"), el("th", { class: "gold-col" }, "Gouden Ei 5"), el("th", {}, "In set")),
      Object.entries(catalog.rarities).map(([k, v]) => el("tr", {}, el("td", {}, v.label), el("td", {}, pct(perKaart[k])), el("td", {}, pct(laatsteKaart[k])), el("td", { class: "gold-col" }, g ? pct(g.perKaart[k]) : "–"), el("td", { class: "gold-col" }, g ? pct(g.laatsteKaart[k]) : "–"), el("td", {}, String(catalog.cards.filter((c) => c.rarity === k).length))))
    ),
    el("h2", {}, "Afwerking (per kaart)"),
    el(
      "table",
      { class: "odds" },
      el("tr", {}, el("th", {}, "Afwerking"), el("th", {}, "Kans"), el("th", { class: "gold-col" }, "Gouden Ei"), el("th", {}, "Waarde ×"), el("th", {}, "Te maken met fossielen")),
      VARIANT_ORDER.slice()
        .reverse()
        .map((k) => el("tr", {}, el("td", {}, catalog.variants[k].label), el("td", {}, k === "normaal" ? pct(afwerking[k]) : oneIn(afwerking[k])), el("td", { class: "gold-col" }, g ? (k === "normaal" ? pct(g.afwerking[k]) : oneIn(g.afwerking[k])) : "–"), el("td", {}, `×${catalog.variants[k].mult}`), el("td", {}, k in catalog.fossils.craftMult ? "Ja" : "Nee, alleen in eieren")))
    ),
    el("p", { class: "muted" }, `Oerkristal-kaarten zijn genummerd: van elke dino bestaan er wereldwijd maximaal ${catalog.kristalCap}. Is de oplage op, dan wordt een Oerkristal-trekking een Prisma. Verzamelwaarde is een puntentelling voor de lol en heeft geen geldwaarde.`),
    el("h2", {}, "Regels"),
    el(
      "ul",
      {},
      el("li", {}, "Alleen voor 18 jaar en ouder."),
      el("li", {}, "Kaarten zijn virtueel, hebben geen geldwaarde en kunnen niet voor geld worden gekocht, verkocht of uitbetaald."),
      el("li", {}, "Gratis en gewone gekochte eieren hebben exact dezelfde kansen. Gouden Eieren hebben de betere kansen uit de tabellen hierboven."),
      el("li", {}, "Kaarten kun je niet ruilen of verkopen. Je kunt ze verstenen tot fossielen en daarmee een dino naar keuze maken (Normaal of Holo). Met fossielen koop je geen eieren."),
      el("li", {}, `Geluksmeter: in uiterlijk elk ${catalog.rules.pity}e ei zit gegarandeerd een Legendarische kaart. Zat er al eerder een in, dan begint de teller opnieuw. Dit geldt voor alle eieren, ook Gouden Eieren.`),
      el("li", {}, "Handel in accounts voor geld is verboden en leidt tot blokkering."),
      el("li", {}, "De soorten zijn echte prehistorische dieren; namen, rijken en krachten zijn verzonnen en de afbeeldingen zijn met AI gemaakt. De weetjes op de kaarten kloppen wel!")
    )
  );
}

// ---------- Router ----------
async function refreshMe() {
  try {
    me = await api("/api/me");
  } catch {
    me = null;
  }
  nav.hidden = !me;
  const bank = document.getElementById("bank");
  if (me) bank.textContent = `${me.fossils.toLocaleString("nl-NL")} 🦴`;
  updateNavDots();
}

// keepOverlay = true: pagina op de achtergrond verversen terwijl een detailvenster open blijft.
async function route(keepOverlay) {
  if (keepOverlay !== true) document.querySelectorAll(".overlay").forEach((o) => o.remove());
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(query);
  clearInterval(packsView.timer);
  resetTilt();
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${path}`));
  try {
    let node;
    if (path === "/regels") node = rulesView();
    else if (path === "/ranglijst") node = await leaderboardView();
    else if (path === "/reset") node = resetView(params);
    else if (path === "/vergeten") node = forgotView();
    else if (path === "/privacy") node = privacyHtml();
    else if (path === "/voorwaarden") node = termsHtml({ pity: catalog.rules.pity, passDays: catalog.products.pass.days });
    else if (!me) node = authView();
    else if (path === "/album") node = albumView();
    else if (path === "/fossielen") node = fossilsView();
    else if (path === "/account") node = accountView();
    else if (path === "/winkel") node = await shopView(params);
    else node = packsView();
    view.replaceChildren(node);
    // Ander scherm (of net in-/uitgelogd): bovenaan beginnen, anders land je op de telefoon halverwege de pagina.
    checkInviteReward();
    // Eén keer per dag vanzelf het beloningsvenster tonen (niet over een betaling of wachtwoordscherm heen).
    if (me && !me.daily?.claimedToday && !dailyShownToday() && !["/reset", "/winkel"].includes(path)) setTimeout(showDaily, 500);
    const screen = `${path}|${!!me}`;
    if (screen !== route.screen) scrollTo(0, 0);
    route.screen = screen;
  } catch (ex) {
    if (ex.status === 401) {
      me = null;
      return route();
    }
    view.replaceChildren(el("p", { class: "error" }, ex.message));
  }
}

window.addEventListener("hashchange", route);
// Welke echte dino-plaatjes er zijn (tools/slice_grid.py schrijft dit bestand).
await fetch("/img/dino/manifest.json")
  .then((r) => (r.ok ? r.json() : { images: [] }))
  .then((m) => setDinoImages(m.images || []))
  .catch(() => {});
try {
  catalog = await api("/api/catalog");
  await refreshMe();
  route();
} catch {
  // Bijvoorbeeld als de database (nog) niet bereikbaar is: nette melding in plaats van een lege pagina.
  view.replaceChildren(
    el(
      "div",
      { class: "panel", style: "max-width:560px;margin:40px auto;text-align:center" },
      el("div", { style: "font-size:3rem" }, "🦖🔧"),
      el("h2", {}, "Even onderhoud"),
      el("p", { class: "muted" }, "DinoRijk is zo weer bereikbaar. Probeer het over een paar minuten opnieuw."),
      el("button", { class: "btn", onclick: () => location.reload() }, "Opnieuw proberen")
    )
  );
}

document.querySelector(".logo").addEventListener("click", () => setTimeout(route));
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-logout]")) api("/api/logout", {}).then(() => ((me = null), refreshMe(), route()));
});

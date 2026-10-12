import { dinoSvg } from "./art.js";

const view = document.getElementById("view");
const nav = document.getElementById("nav");
let catalog;
let me = null;

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
      el("p", { class: "muted" }, catalog.variants[current].tradeable ? "Deze afwerking is ruilbaar (als je hem dubbel hebt)." : "🔒 Kluiskaart: niet ruilbaar, alleen om te pronken."),
      el("button", { class: "btn", onclick: close }, "Sluiten")
    );
  };
  render();
  const overlay = el("div", { class: "overlay", onclick: (e) => e.target === overlay && close() }, el("div", { class: "detail" }, big, info));
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") close(), document.removeEventListener("keydown", esc);
  });
  document.body.append(overlay);
}

// ---------- Schermen ----------
function authView() {
  let mode = "register";
  const err = el("p", { class: "error", role: "alert" });
  const form = el("form", { class: "panel" });
  const render = () => {
    form.replaceChildren(
      el(
        "div",
        { class: "tabs" },
        el("button", { type: "button", class: `btn small ${mode === "register" ? "" : "ghost"}`, onclick: () => ((mode = "register"), render()) }, "Nieuw account"),
        el("button", { type: "button", class: `btn small ${mode === "login" ? "" : "ghost"}`, onclick: () => ((mode = "login"), render()) }, "Inloggen")
      ),
      el("label", { for: "u" }, "Gebruikersnaam"),
      el("input", { id: "u", name: "username", autocomplete: "username", required: true, maxlength: 20 }),
      el("label", { for: "p" }, "Wachtwoord"),
      el("input", { id: "p", name: "password", type: "password", autocomplete: mode === "login" ? "current-password" : "new-password", required: true, minlength: 8 }),
      mode === "register" ? el("label", { class: "check" }, el("input", { type: "checkbox", name: "adult", required: true }), "Ik ben 18 jaar of ouder en snap dat kaarten geen geldwaarde hebben.") : null,
      err,
      el("button", { class: "btn", type: "submit" }, mode === "register" ? "Start met 2 gratis eieren" : "Inloggen")
    );
  };
  render();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    try {
      await api(mode === "register" ? "/api/register" : "/api/login", { username: d.get("username"), password: d.get("password"), adult: d.get("adult") === "on" });
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
      el("h1", {}, "Vang ze allemaal"),
      el("p", { class: "muted" }, `${catalog.cards.length} dino's uit ${catalog.groups.length} rijken. Broed elke dag gratis eieren uit en jaag op Holo, Goudfolie, Prisma en de genummerde Oerkristal-kaarten: daarvan bestaan er maar ${catalog.kristalCap} per dino in de héle wereld.`),
      showcase
    ),
    form
  );
}

function packsView() {
  const wrap = el("div", { class: "packs-hero" });
  const render = () => {
    const { available, max, nextAt } = me.packs;
    const pack = el("div", { class: `pack${available ? "" : " empty"}`, role: "button", tabindex: 0, "aria-label": "Broed ei uit" }, el("span", {}, catalog.game, el("br"), `Seizoen ${catalog.season}`));
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
    const open = async () => {
      if (!me.packs.available || pack.classList.contains("hatch")) return;
      pack.classList.add("hatch");
      try {
        const before = { ...me.collection };
        const { cards } = await api("/api/packs/open", {});
        await refreshMe();
        setTimeout(() => showReveal(cards, before), 900);
      } catch (ex) {
        toast(ex.message);
        pack.classList.remove("hatch");
      }
    };
    pack.addEventListener("click", open);
    pack.addEventListener("keydown", (e) => e.key === "Enter" && open());
    put(
      wrap,
      "replaceChildren",
      el("h1", {}, available ? `${available} ${available > 1 ? "eieren" : "ei"} klaar` : "Even geduld…"),
      el("p", { class: "muted" }, "Tik op het ei om het uit te broeden. Gloeit een kaart al op de achterkant? Dan zit er iets bijzonders in…"),
      pack,
      countdown,
      el("p", { class: "muted" }, `Verzamelwaarde: `, el("b", {}, `${me.value.toLocaleString("nl-NL")} punten`)),
      me.premiumUntil ? null : el("p", {}, el("a", { href: "#/winkel" }, "Met de Seizoenspas krijg je 2× zo snel een nieuw ei →"))
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
        el("button", { class: "btn", onclick: render }, "Verder")
      )
    );
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
    if (filter === "dubbel") return ["normaal", "holo"].some((v) => me.collection[keyOf(c.id, v)] > 1);
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
              if (!variants.length) return cardEl(c, { missing: true });
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
    [["alle", "Alles"], ["glans", "✨ Holo en hoger"], ["dubbel", "Dubbel (ruilbaar)"], ...Object.entries(catalog.rarities).map(([k, v]) => [k, v.label])].map(([k, label]) => {
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
    el("p", { class: "muted" }, `${ownedCards.length} van de ${catalog.cards.length} dino's (${pct}%) · ${special} glanskaarten · ${me.packsOpened} eieren uitgebroed · verzamelwaarde `, el("b", {}, `${me.value.toLocaleString("nl-NL")} punten`)),
    bar,
    filters,
    body
  );
}

async function tradeView() {
  const { trades } = await api("/api/trades");
  const dupes = Object.entries(me.collection)
    .filter(([key, n]) => n > 1 && catalog.variants[parseKey(key).variant].tradeable)
    .map(([key]) => key);
  let give = null;
  let want = null;
  const err = el("p", { class: "error", role: "alert" });
  const wantRow = el("div", { class: "pick" });
  const giveRow = el("div", { class: "pick" });

  const pickCard = (key, sel, onclick, count = 0) => {
    const { card, variant } = parseKey(key);
    const node = cardEl(card, { variant, count });
    node.classList.toggle("sel", sel);
    node.addEventListener("click", onclick);
    return node;
  };
  const renderPick = () => {
    giveRow.replaceChildren(...(dupes.length ? dupes.map((k) => pickCard(k, give === k, () => ((give = k), (want = null), renderPick()), me.collection[k])) : [el("p", { class: "muted" }, "Je hebt nog geen dubbele ruilbare kaarten. Broed meer eieren uit!")]));
    if (!give) return wantRow.replaceChildren(el("p", { class: "muted" }, "Kies eerst welke kaart je weggeeft."));
    const g = parseKey(give);
    wantRow.replaceChildren(
      ...catalog.cards
        .filter((c) => c.rarity === g.card.rarity && c.id !== g.card.id)
        .map((c) => keyOf(c.id, g.variant))
        .map((k) => pickCard(k, want === k, () => ((want = k), renderPick())))
    );
  };
  renderPick();

  const to = el("input", { placeholder: "Gebruikersnaam van je vriend", maxlength: 20 });
  const send = el("button", { class: "btn" }, "Stuur ruilvoorstel");
  send.addEventListener("click", async () => {
    err.textContent = "";
    if (!give || !want || !to.value.trim()) return (err.textContent = "Kies twee kaarten en vul een gebruikersnaam in.");
    try {
      await api("/api/trades", { to: to.value.trim(), give, want });
      toast("Ruilvoorstel verstuurd!");
      await refreshMe();
      route();
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  const act = (id, action, msg) => async () => {
    try {
      await api(`/api/trades/${id}/${action}`, {});
      toast(msg);
      await refreshMe();
      route();
    } catch (ex) {
      toast(ex.message);
      route();
    }
  };
  const STATUS = { open: "Open", accepted: "Geruild ✓", declined: "Afgewezen", cancelled: "Ingetrokken", failed: "Mislukt" };
  const mini = (key) => {
    const { card, variant } = parseKey(key);
    return el("div", { class: "mini" }, cardEl(card, { variant }));
  };
  const list = trades.length
    ? trades.map((t) =>
        el(
          "div",
          { class: "trade" },
          el("div", {}, el("b", {}, t.mine ? `Jij → ${t.to_name}` : `${t.from_name} → jou`), el("div", { class: "muted" }, STATUS[t.status])),
          mini(t.mine ? t.give_card : t.want_card),
          el("span", { class: "arrow" }, "⇄"),
          mini(t.mine ? t.want_card : t.give_card),
          t.status === "open" && !t.mine ? [el("button", { class: "btn small", onclick: act(t.id, "accept", "Geruild!") }, "Accepteren"), el("button", { class: "btn small ghost", onclick: act(t.id, "decline", "Afgewezen") }, "Afwijzen")] : null,
          t.status === "open" && t.mine ? el("button", { class: "btn small ghost", onclick: act(t.id, "cancel", "Ingetrokken") }, "Intrekken") : null
        )
      )
    : [el("p", { class: "muted" }, "Nog geen ruilvoorstellen.")];

  return el(
    "div",
    {},
    el("h1", {}, "Ruilen"),
    el("p", { class: "muted" }, `Ruil dubbele kaarten met vrienden: kaart tegen kaart, zelfde zeldzaamheid én afwerking (Normaal of Holo). Kluiskaarten zijn niet ruilbaar. Je kunt vandaag nog ${me.tradesLeftToday} voorstellen doen. Jouw gebruikersnaam: `, el("b", {}, me.username)),
    el("div", { class: "panel" }, el("h2", {}, "Voorstellen"), list),
    el("br"),
    el("div", { class: "panel" }, el("h2", {}, "Nieuw voorstel"), el("label", {}, "1. Welke dubbele kaart geef je weg?"), giveRow, el("label", {}, "2. Welke kaart wil je terug?"), wantRow, el("label", {}, "3. Met wie?"), to, err, send)
  );
}

async function shopView(params) {
  if (params.get("betaald")) {
    const { premiumUntil } = await api("/api/pass/verify", {});
    await refreshMe();
    toast(premiumUntil ? "Seizoenspas actief! 🎉" : "Betaling nog niet binnen. Probeer het zo opnieuw.");
    history.replaceState(null, "", "#/winkel");
  }
  const { pass, rules } = catalog;
  const buy = el("button", { class: "btn" }, me.premiumUntil ? "Verleng met 30 dagen" : "Koop de Seizoenspas");
  buy.addEventListener("click", async () => {
    buy.disabled = true;
    try {
      const { url } = await api("/api/pass/checkout", {});
      if (url.startsWith("/")) {
        location.hash = url.slice(1);
        route();
      } else location.href = url;
    } catch (ex) {
      toast(ex.message);
      buy.disabled = false;
    }
  });
  return el(
    "div",
    { class: "grid2" },
    el(
      "div",
      { class: "panel" },
      el("h1", {}, "Seizoenspas"),
      el("div", { class: "price" }, `€${(pass.price / 100).toFixed(2).replace(".", ",")}`),
      el("p", { class: "muted" }, "30 dagen · eenmalig, geen abonnement"),
      el("ul", { class: "ticks" }, el("li", {}, `Elke ${rules.premium.interval / 3600000} uur een gratis ei (normaal ${rules.free.interval / 3600000} uur)`), el("li", {}, `Spaar tot ${rules.premium.max} eieren op (normaal ${rules.free.max})`), el("li", {}, "Je steunt de makers van DinoRijk")),
      me.premiumUntil ? el("p", {}, `Actief tot ${new Date(me.premiumUntil).toLocaleDateString("nl-NL")}`) : null,
      buy,
      catalog.demoMode ? el("p", { class: "muted" }, "Testmodus: er wordt niets afgeschreven.") : el("p", { class: "muted" }, "Betalen met iDEAL, Bancontact of creditcard via Mollie.")
    ),
    el("div", {}, el("h2", {}, "Eerlijk spel"), el("p", { class: "muted" }, "Iedereen krijgt dezelfde kansen, met of zonder pas. De pas geeft je alleen sneller eieren. Kaarten kun je nooit voor geld kopen of verkopen."), el("a", { href: "#/regels" }, "Bekijk de kansen per kaart →"))
  );
}

function rulesView() {
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const { perKaart, laatsteKaart, afwerking } = catalog.odds;
  return el(
    "div",
    { class: "panel" },
    el("h1", {}, "Kansen & regels"),
    el("p", {}, "Een ei bevat 5 kaarten. Elke kaart krijgt eerst een zeldzaamheid en daarna, los daarvan, een afwerking."),
    el("h2", {}, "Zeldzaamheid"),
    el(
      "table",
      { class: "odds" },
      el("tr", {}, el("th", {}, "Zeldzaamheid"), el("th", {}, "Kaart 1–4"), el("th", {}, "Kaart 5"), el("th", {}, "Aantal in set")),
      Object.entries(catalog.rarities).map(([k, v]) => el("tr", {}, el("td", {}, v.label), el("td", {}, pct(perKaart[k])), el("td", {}, pct(laatsteKaart[k])), el("td", {}, String(catalog.cards.filter((c) => c.rarity === k).length))))
    ),
    el("h2", {}, "Afwerking (per kaart)"),
    el(
      "table",
      { class: "odds" },
      el("tr", {}, el("th", {}, "Afwerking"), el("th", {}, "Kans"), el("th", {}, "Waarde ×"), el("th", {}, "Ruilbaar")),
      VARIANT_ORDER.slice()
        .reverse()
        .map((k) => el("tr", {}, el("td", {}, catalog.variants[k].label), el("td", {}, k === "normaal" ? pct(afwerking[k]) : oneIn(afwerking[k])), el("td", {}, `×${catalog.variants[k].mult}`), el("td", {}, catalog.variants[k].tradeable ? "Ja" : "🔒 Nee")))
    ),
    el("p", { class: "muted" }, `Oerkristal-kaarten zijn genummerd: van elke dino bestaan er wereldwijd maximaal ${catalog.kristalCap}. Is de oplage op, dan wordt een Oerkristal-trekking een Prisma. Verzamelwaarde is een puntentelling voor de lol en heeft geen geldwaarde.`),
    el("h2", {}, "Regels"),
    el(
      "ul",
      {},
      el("li", {}, "Alleen voor 18 jaar en ouder."),
      el("li", {}, "Kaarten zijn virtueel, hebben geen geldwaarde en kunnen niet voor geld worden gekocht, verkocht of uitbetaald."),
      el("li", {}, `Ruilen kan alleen met dubbele Normaal- of Holo-kaarten: kaart tegen kaart, zelfde zeldzaamheid en afwerking, maximaal ${catalog.rules.tradesPerDay} voorstellen per dag.`),
      el("li", {}, "Handel in accounts of kaarten voor geld buiten de site is verboden en leidt tot blokkering."),
      el("li", {}, "De soorten zijn echte prehistorische dieren; namen, rijken, krachten en tekeningen zijn verzonnen. De weetjes op de kaarten kloppen wel!")
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
  const badge = document.getElementById("tradeBadge");
  if (me) {
    api("/api/trades")
      .then(({ trades }) => {
        const n = trades.filter((t) => t.status === "open" && !t.mine).length;
        badge.hidden = !n;
        badge.textContent = n;
      })
      .catch(() => {});
  }
}

async function route() {
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(query);
  clearInterval(packsView.timer);
  resetTilt();
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${path}`));
  try {
    let node;
    if (path === "/regels") node = rulesView();
    else if (!me) node = authView();
    else if (path === "/album") node = albumView();
    else if (path === "/ruilen") node = await tradeView();
    else if (path === "/winkel") node = await shopView(params);
    else node = packsView();
    view.replaceChildren(node);
  } catch (ex) {
    if (ex.status === 401) {
      me = null;
      return route();
    }
    view.replaceChildren(el("p", { class: "error" }, ex.message));
  }
}

window.addEventListener("hashchange", route);
catalog = await api("/api/catalog");
await refreshMe();
route();

document.querySelector(".logo").addEventListener("click", () => setTimeout(route));
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-logout]")) api("/api/logout", {}).then(() => ((me = null), refreshMe(), route()));
});

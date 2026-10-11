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
  for (const c of children.flat()) if (c != null && c !== false) node.append(c);
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

const clubOf = (id) => catalog.clubs.find((c) => c.id === id);
const cardOf = (id) => catalog.cards.find((c) => c.id === id);
const fmtTime = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} u ${m % 60} min` : `${m} min`;
};

// ---------- Kaart tekenen ----------
const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#5c3a21"];
const HAIR = ["#1b1b1b", "#4a2c17", "#a0522d", "#e6c06b", "#7b7b7b", "#2d1b0e"];

function faceSvg(card) {
  const [c1, c2] = clubOf(card.club).colors;
  let s = card.look;
  const pick = (n) => ((s = (s * 9301 + 49297) % 233280), s % n);
  const skin = SKIN[pick(SKIN.length)];
  const hair = HAIR[pick(HAIR.length)];
  const style = pick(4);
  const shirt = pick(3);
  const hairPath = [
    "M30 38 Q50 14 70 38 L70 32 Q50 6 30 32 Z",
    "M28 40 Q30 12 50 12 Q70 12 72 40 Q66 26 50 24 Q34 26 28 40 Z",
    "M32 34 Q50 22 68 34 Q60 16 50 16 Q40 16 32 34 Z",
    "M29 42 Q26 10 50 10 Q74 10 71 42 L66 30 Q50 20 34 30 Z",
  ][style];
  const shirtFill = shirt === 0 ? c2 : "url(#p" + card.number + ")";
  return `<svg class="face" viewBox="0 0 100 100" aria-hidden="true">
    <defs><pattern id="p${card.number}" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="${c2}"/>${shirt === 1 ? `<rect width="6" height="12" fill="${c1}"/>` : `<rect width="12" height="6" fill="${c1}"/>`}
    </pattern></defs>
    <path d="M14 100 Q16 70 50 66 Q84 70 86 100 Z" fill="${shirtFill}" stroke="#0005" stroke-width="1.5"/>
    <path d="M42 66 L50 76 L58 66" fill="none" stroke="#0006" stroke-width="2"/>
    <rect x="43" y="54" width="14" height="14" rx="4" fill="${skin}"/>
    <ellipse cx="50" cy="42" rx="20" ry="23" fill="${skin}"/>
    <path d="${hairPath}" fill="${hair}"/>
    <circle cx="43" cy="44" r="2.2" fill="#222"/><circle cx="57" cy="44" r="2.2" fill="#222"/>
    <path d="M44 54 Q50 58 56 54" fill="none" stroke="#7a3b2e" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function cardEl(card, { count = 0, missing = false } = {}) {
  const club = clubOf(card.club);
  const node = el("div", { class: `card ${card.rarity}${missing ? " missing" : ""}`, title: `${card.name} – ${club.name}` });
  node.style.setProperty("--c1", club.colors[0]);
  node.style.setProperty("--c2", club.colors[1]);
  if (missing) {
    node.append(el("span", { class: "num" }, `#${card.number}`), el("span", { class: "ghostname" }, "?"));
    return node;
  }
  node.insertAdjacentHTML("beforeend", faceSvg(card));
  node.append(
    el("span", { class: "rating" }, String(card.rating)),
    el("span", { class: "pos" }, card.pos),
    el("span", { class: "tier" }, catalog.rarities[card.rarity].label),
    el("span", { class: "num" }, `#${card.number}`),
    el("span", { class: "name" }, card.name),
    el("span", { class: "club" }, club.name),
    el("div", { class: "stats" }, Object.entries(card.stats).map(([k, v]) => el("span", {}, el("b", {}, String(v)), k))),
    count > 1 ? el("span", { class: "count" }, `×${count}`) : ""
  );
  return node;
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
      el("button", { class: "btn", type: "submit" }, mode === "register" ? "Start met 2 gratis pakjes" : "Inloggen")
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

  const showcase = el("div", { class: "reveal" }, ["icoon", "goud", "zilver"].map((r) => cardEl(catalog.cards.find((c) => c.rarity === r))));
  return el(
    "div",
    { class: "grid2" },
    el(
      "div",
      {},
      el("h1", {}, "Verzamel ze allemaal"),
      el("p", { class: "muted" }, `${catalog.cards.length} spelers, ${catalog.clubs.length} clubs, één competitie: ${catalog.league}. Open elke dag gratis pakjes, jaag op de Iconen en ruil je dubbele kaarten met vrienden.`),
      showcase
    ),
    form
  );
}

function packsView() {
  const wrap = el("div", { class: "packs-hero" });
  const render = () => {
    const { available, max, nextAt } = me.packs;
    const pack = el("div", { class: `pack${available ? "" : " empty"}`, role: "button", tabindex: 0, "aria-label": "Open pakje" }, el("span", {}, catalog.league, el("br"), `Seizoen ${catalog.season}`, el("br"), "⚽"));
    const countdown = el("p", { class: "muted" });
    const tickTimer = () => {
      if (!nextAt) return (countdown.textContent = `Je pakjes zijn vol (${max}/${max}). Open ze!`);
      const left = nextAt - Date.now();
      if (left <= 0) return refreshMe().then(render);
      countdown.textContent = `Volgend gratis pakje over ${fmtTime(left)}`;
    };
    tickTimer();
    clearInterval(packsView.timer);
    packsView.timer = setInterval(tickTimer, 30000);
    const open = async () => {
      if (!me.packs.available || pack.classList.contains("shake")) return;
      pack.classList.add("shake");
      try {
        const before = { ...me.collection };
        const { cards } = await api("/api/packs/open", {});
        await refreshMe();
        setTimeout(() => showReveal(cards, before), 450);
      } catch (ex) {
        toast(ex.message);
        pack.classList.remove("shake");
      }
    };
    pack.addEventListener("click", open);
    pack.addEventListener("keydown", (e) => e.key === "Enter" && open());
    wrap.replaceChildren(
      el("h1", {}, available ? `${available} pakje${available > 1 ? "s" : ""} klaar` : "Even geduld…"),
      el("p", { class: "muted" }, "Tik op het pakje om het te openen. 5 kaarten, de laatste is altijd minimaal Zilver."),
      pack,
      countdown,
      me.premiumUntil ? null : el("p", {}, el("a", { href: "#/winkel" }, "Met de Seizoenspas laden je pakjes 2× zo snel op →"))
    );
  };

  const showReveal = (cards, before) => {
    const seen = { ...before };
    const row = el(
      "div",
      { class: "reveal" },
      cards.map((id) => {
        const card = cardOf(id);
        const isNew = !seen[id];
        seen[id] = (seen[id] || 0) + 1;
        const f = el("div", { class: `flip ${card.rarity}`, tabindex: 0 }, el("div", { class: "back" }, "⚽"), el("div", { class: "front" }, cardEl(card)), isNew ? el("span", { class: "newtag" }, "NIEUW") : null);
        f.addEventListener("click", () => f.classList.add("open"));
        f.addEventListener("keydown", (e) => e.key === "Enter" && f.classList.add("open"));
        return f;
      })
    );
    wrap.replaceChildren(
      el("h1", {}, "Wat zit erin?"),
      el("p", { class: "muted" }, "Tik op de kaarten om ze om te draaien."),
      row,
      el(
        "p",
        {},
        el("button", { class: "btn ghost", onclick: () => row.querySelectorAll(".flip").forEach((f, i) => setTimeout(() => f.classList.add("open"), i * 180)) }, "Alles omdraaien"),
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
  const owned = Object.keys(me.collection).length;
  const body = el("div");
  const render = () => {
    body.replaceChildren(
      ...catalog.clubs.map((club) => {
        const cards = catalog.cards.filter((c) => c.club === club.id && (filter === "alle" || (filter === "dubbel" ? me.collection[c.id] > 1 : c.rarity === filter)));
        if (!cards.length) return "";
        const have = catalog.cards.filter((c) => c.club === club.id && me.collection[c.id]).length;
        const dot = el("span", { class: "dot" });
        dot.style.background = club.colors[0];
        return el("section", { class: "club-row" }, el("h3", {}, dot, club.name, el("span", { class: "muted" }, ` ${have}/8`)), el("div", { class: "cards" }, cards.map((c) => cardEl(c, { count: me.collection[c.id] || 0, missing: !me.collection[c.id] }))));
      })
    );
  };
  const filters = el(
    "div",
    { class: "filters" },
    [["alle", "Alles"], ["dubbel", "Dubbel (ruilbaar)"], ...Object.entries(catalog.rarities).map(([k, v]) => [k, v.label])].map(([k, label]) => {
      const b = el("button", { class: k === filter ? "on" : "", onclick: () => ((filter = k), filters.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)), render()) }, label);
      return b;
    })
  );
  render();
  const pct = Math.round((owned / catalog.cards.length) * 100);
  const bar = el("div", { class: "progress" }, el("i"));
  bar.firstChild.style.width = `${pct}%`;
  return el("div", {}, el("h1", {}, "Mijn album"), el("p", { class: "muted" }, `${owned} van de ${catalog.cards.length} spelers (${pct}%) · ${me.packsOpened} pakjes geopend`), bar, filters, body);
}

async function tradeView() {
  const { trades } = await api("/api/trades");
  const dupes = catalog.cards.filter((c) => me.collection[c.id] > 1);
  let give = null;
  let want = null;
  const err = el("p", { class: "error", role: "alert" });
  const wantRow = el("div", { class: "pick" });
  const giveRow = el("div", { class: "pick" });

  const renderPick = () => {
    giveRow.replaceChildren(...(dupes.length ? dupes.map((c) => withSelect(c, give === c.id, () => ((give = c.id), (want = null), renderPick()), me.collection[c.id])) : [el("p", { class: "muted" }, "Je hebt nog geen dubbele kaarten. Open meer pakjes!")]));
    const g = give && cardOf(give);
    wantRow.replaceChildren(
      ...(g ? catalog.cards.filter((c) => c.rarity === g.rarity && c.id !== g.id).map((c) => withSelect(c, want === c.id, () => ((want = c.id), renderPick()), 0)) : [el("p", { class: "muted" }, "Kies eerst welke kaart je weggeeft.")])
    );
  };
  const withSelect = (c, sel, onclick, count) => {
    const node = cardEl(c, { count });
    node.classList.toggle("sel", sel);
    node.addEventListener("click", onclick);
    return node;
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
  const list = trades.length
    ? trades.map((t) => {
        const mini = (id) => el("div", { class: "mini" }, cardEl(cardOf(id)));
        const yourCard = t.mine ? t.give_card : t.want_card;
        const theirCard = t.mine ? t.want_card : t.give_card;
        return el(
          "div",
          { class: "trade" },
          el("div", {}, el("b", {}, t.mine ? `Jij → ${t.to_name}` : `${t.from_name} → jou`), el("div", { class: "muted" }, STATUS[t.status])),
          mini(yourCard),
          el("span", { class: "arrow" }, "⇄"),
          mini(theirCard),
          t.status === "open" && !t.mine ? [el("button", { class: "btn small", onclick: act(t.id, "accept", "Geruild!") }, "Accepteren"), el("button", { class: "btn small ghost", onclick: act(t.id, "decline", "Afgewezen") }, "Afwijzen")] : null,
          t.status === "open" && t.mine ? el("button", { class: "btn small ghost", onclick: act(t.id, "cancel", "Ingetrokken") }, "Intrekken") : null
        );
      })
    : [el("p", { class: "muted" }, "Nog geen ruilvoorstellen.")];

  return el(
    "div",
    {},
    el("h1", {}, "Ruilen"),
    el("p", { class: "muted" }, `Ruil je dubbele kaarten met vrienden: kaart tegen kaart, dezelfde zeldzaamheid. Je kunt vandaag nog ${me.tradesLeftToday} voorstellen doen. Jouw gebruikersnaam: `, el("b", {}, me.username)),
    el("div", { class: "panel" }, el("h2", {}, "Voorstellen"), list),
    el("br"),
    el(
      "div",
      { class: "panel" },
      el("h2", {}, "Nieuw voorstel"),
      el("label", {}, "1. Welke dubbele kaart geef je weg?"),
      giveRow,
      el("label", {}, "2. Welke kaart wil je terug?"),
      wantRow,
      el("label", {}, "3. Met wie?"),
      to,
      err,
      send
    )
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
      el("ul", { class: "ticks" }, el("li", {}, `Elke ${rules.premium.interval / 3600000} uur een gratis pakje (normaal ${rules.free.interval / 3600000} uur)`), el("li", {}, `Spaar tot ${rules.premium.max} pakjes op (normaal ${rules.free.max})`), el("li", {}, "Je steunt de makers van De Polder Liga")),
      me.premiumUntil ? el("p", {}, `Actief tot ${new Date(me.premiumUntil).toLocaleDateString("nl-NL")}`) : null,
      buy,
      catalog.demoMode ? el("p", { class: "muted" }, "Testmodus: er wordt niets afgeschreven.") : el("p", { class: "muted" }, "Betalen met iDEAL, Bancontact of creditcard via Mollie.")
    ),
    el("div", {}, el("h2", {}, "Eerlijk spel"), el("p", { class: "muted" }, "Iedereen krijgt dezelfde kansen, met of zonder pas. De pas geeft je alleen sneller pakjes. Kaarten kun je nooit voor geld kopen of verkopen."), el("a", { href: "#/regels" }, "Bekijk de kansen per kaart →"))
  );
}

function rulesView() {
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const { perKaart, laatsteKaart } = catalog.odds;
  return el(
    "div",
    { class: "panel" },
    el("h1", {}, "Kansen & regels"),
    el("p", {}, `Een pakje bevat 5 kaarten. Elke kaart binnen een zeldzaamheid heeft precies dezelfde kans.`),
    el(
      "table",
      { class: "odds" },
      el("tr", {}, el("th", {}, "Zeldzaamheid"), el("th", {}, "Kaart 1–4"), el("th", {}, "Kaart 5"), el("th", {}, "Aantal in set")),
      Object.entries(catalog.rarities).map(([k, v]) => el("tr", {}, el("td", {}, v.label), el("td", {}, pct(perKaart[k])), el("td", {}, pct(laatsteKaart[k])), el("td", {}, String(catalog.cards.filter((c) => c.rarity === k).length))))
    ),
    el("h2", {}, "Regels"),
    el(
      "ul",
      {},
      el("li", {}, "Alleen voor 18 jaar en ouder."),
      el("li", {}, "Kaarten zijn virtueel, hebben geen geldwaarde en kunnen niet voor geld worden gekocht, verkocht of uitbetaald."),
      el("li", {}, `Ruilen kan alleen kaart tegen kaart, dezelfde zeldzaamheid, met dubbele kaarten, maximaal ${catalog.rules.tradesPerDay} voorstellen per dag.`),
      el("li", {}, "Handel in accounts of kaarten voor geld buiten de site is verboden en leidt tot blokkering."),
      el("li", {}, "Alle spelers en clubs zijn verzonnen. Gelijkenis met echte personen of clubs berust op toeval.")
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

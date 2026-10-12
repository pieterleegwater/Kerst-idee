// Animaties: ei uitbroeden, kaarten uitdelen, verstenen (kaart brokkelt af) en maken (kaart komt tot leven).
// Alles met de Web Animations API; met "minder beweging" aan op het toestel slaan we ze over.
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const center = (node) => {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
};

function layer() {
  const l = document.createElement("div");
  l.className = "fx-layer";
  document.body.append(l);
  return l;
}
function dot(l, x, y, cls, text = "") {
  const d = document.createElement("span");
  d.className = cls;
  d.textContent = text;
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  l.append(d);
  return d;
}

// Kleur van het licht uit het ei: verraadt al iets over de beste kaart.
const GLOW = { kristal: "#7df9ff", prisma: "#ff7df0", goud: "#ffd166", icoon: "#c77dff", holo: "#8fd3ff", normaal: "#ffb703" };
export function bestTier(cards, parse) {
  const order = ["kristal", "prisma", "goud", "icoon", "holo"];
  const found = cards.map((c) => parse(c.key)).flatMap(({ card, variant }) => [variant, card.rarity === "icoon" ? "icoon" : null]);
  return order.find((t) => found.includes(t)) || "normaal";
}

// Stap 1 (direct bij de tik): het ei begint te schudden terwijl we de kaarten ophalen.
export function startShake(pack) {
  if (!reduced()) pack.classList.add("shake");
}

// Stap 2: barsten met licht erdoorheen, dan spat het ei open.
export async function hatch(pack, tier = "normaal") {
  if (reduced()) return;
  const glow = GLOW[tier];
  const rare = tier !== "normaal";
  pack.style.setProperty("--glow", glow);
  pack.classList.add("shake", rare ? "shake-hard" : "shake");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 125");
  svg.setAttribute("class", "cracks");
  const paths = [
    "M50 8 L45 26 L54 38 L46 52 L55 66",
    "M18 60 L32 56 L38 66 L50 62",
    "M86 58 L72 62 L66 52 L55 66",
    "M55 66 L50 82 L58 96 L52 116",
  ];
  svg.innerHTML = paths.map((d, i) => `<path d="${d}" style="--i:${i}"/>`).join("");
  pack.append(svg);
  await wait(rare ? 1100 : 650);

  const l = layer();
  const { x, y, r } = center(pack);
  // Licht en stralen
  const light = dot(l, x, y, "egg-light");
  light.style.setProperty("--glow", glow);
  light.animate([{ scale: 0.2, opacity: 1 }, { scale: 5, opacity: 0 }], { duration: 900, easing: "ease-out", fill: "forwards" });
  const rays = dot(l, x, y, `egg-rays${tier === "prisma" ? " rainbow" : ""}`);
  rays.style.setProperty("--glow", glow);
  rays.animate([{ scale: 0.4, rotate: "0deg", opacity: 0.95 }, { scale: rare ? 3.2 : 2.4, rotate: "70deg", opacity: 0 }], { duration: rare ? 1400 : 1000, easing: "ease-out", fill: "forwards" });
  pack.style.visibility = "hidden";
  // Schaalstukjes
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd(-0.2, 0.2);
    const s = dot(l, x + Math.cos(a) * r.width * 0.25, y + Math.sin(a) * r.height * 0.25, "shard");
    s.style.width = s.style.height = `${rnd(26, 52)}px`;
    s.style.clipPath = `polygon(${rnd(0, 40)}% 0, 100% ${rnd(10, 50)}%, ${rnd(50, 100)}% 100%, 0 ${rnd(40, 90)}%)`;
    const dx = Math.cos(a) * rnd(110, 220);
    const dy = Math.sin(a) * rnd(90, 180);
    s.animate(
      [
        { translate: "0 0", rotate: "0deg", opacity: 1 },
        { translate: `${dx * 0.7}px ${dy * 0.7 - 70}px`, rotate: `${rnd(-200, 200)}deg`, opacity: 1, offset: 0.45 },
        { translate: `${dx}px ${dy + 260}px`, rotate: `${rnd(-400, 400)}deg`, opacity: 0 },
      ],
      { duration: 1100, easing: "cubic-bezier(.2,.6,.5,1)", fill: "forwards" }
    );
  }
  // Vonken
  for (let i = 0; i < (rare ? 30 : 16); i++) {
    const a = rnd(0, Math.PI * 2);
    const d = dot(l, x, y, "spark");
    d.style.background = tier === "prisma" ? `hsl(${rnd(0, 360)} 100% 65%)` : glow;
    d.animate([{ translate: "0 0", opacity: 1 }, { translate: `${Math.cos(a) * rnd(80, 260)}px ${Math.sin(a) * rnd(80, 260)}px`, opacity: 0, scale: 0.3 }], {
      duration: rnd(600, 1100),
      easing: "cubic-bezier(.1,.7,.3,1)",
      fill: "forwards",
    });
  }
  await wait(420);
  setTimeout(() => l.remove(), 1400);
}

// Stap 3: kaarten één voor één uitdelen vanuit het midden.
export function deal(flips) {
  if (reduced()) return;
  flips.forEach((f, i) => {
    f.animate(
      [
        // Geen opacity: dat maakt de 3D-kaart plat en dan zie je de voorkant gespiegeld.
        { translate: "0 -110px", scale: 0.05, rotate: `${i % 2 ? 14 : -14}deg` },
        { translate: "0 0", scale: 1, rotate: "0deg" },
      ],
      { duration: 520, delay: i * 120, easing: "cubic-bezier(.2,1.35,.45,1)", fill: "backwards" }
    );
  });
}

// Fossielenteller laten optellen (of aftellen).
export function countTo(node, from, to, duration = 700) {
  if (!node) return;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    node.textContent = `${Math.round(from + (to - from) * p).toLocaleString("nl-NL")} 🦴`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  node.animate([{ scale: 1 }, { scale: 1.35 }, { scale: 1 }], { duration: 380, delay: duration - 200, easing: "ease-out" });
}

// Botjes laten vliegen van `from` naar `to` (elementen), in een boogje.
async function bones(from, to, n) {
  if (!from || !to) return;
  const l = layer();
  const a = center(from);
  const b = center(to);
  const anims = [];
  for (let i = 0; i < n; i++) {
    const s = dot(l, a.x + rnd(-30, 30), a.y + rnd(-30, 30), "bone", "🦴");
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    anims.push(
      s.animate(
        [
          { translate: "0 0", scale: 0.4, opacity: 0 },
          { translate: `${dx * 0.35 + rnd(-60, 60)}px ${dy * 0.35 - rnd(80, 150)}px`, scale: 1.3, opacity: 1, offset: 0.4 },
          { translate: `${dx}px ${dy}px`, scale: 0.6, opacity: 0.9 },
        ],
        { duration: 750, delay: i * 70, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" }
      ).finished
    );
  }
  await Promise.all(anims).catch(() => {});
  l.remove();
}
const boneCount = (n) => Math.max(3, Math.min(12, Math.ceil(n / 10)));
const bank = () => document.getElementById("bank");

// Verstenen: kaart wordt steen, barst en brokkelt af; botjes vliegen naar de teller.
export async function crumble(card, gained, fossilsBefore) {
  if (reduced() || !card) return;
  const { r } = center(card);
  const l = layer();
  const box = document.createElement("div");
  box.className = "stone-box";
  Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const ghost = card.cloneNode(true);
  ghost.style.cssText = `width:${r.width}px;transform:none`;
  ghost.classList.remove("active");
  box.append(ghost);
  l.append(box);
  card.style.visibility = "hidden";
  // 1. versteent
  await box.animate(
    [
      { filter: "none", translate: "0 0" },
      { filter: "grayscale(1) sepia(.35) brightness(.75) contrast(1.15)", translate: "-3px 0", offset: 0.6 },
      { filter: "grayscale(1) sepia(.35) brightness(.7) contrast(1.2)", translate: "3px 0", offset: 0.8 },
      { filter: "grayscale(1) sepia(.35) brightness(.7) contrast(1.2)", translate: "0 0" },
    ],
    { duration: 650, easing: "ease-in", fill: "forwards" }
  ).finished;
  // 2. barsten
  const cracks = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cracks.setAttribute("viewBox", "0 0 100 140");
  cracks.setAttribute("preserveAspectRatio", "none");
  cracks.setAttribute("class", "stone-cracks");
  cracks.innerHTML = ["M50 0 L44 30 L56 52 L42 80 L55 104 L48 140", "M0 46 L24 52 L44 30", "M100 70 L72 76 L56 52", "M0 110 L28 100 L55 104 L80 122 L100 116"]
    .map((d, i) => `<path d="${d}" style="--i:${i}"/>`)
    .join("");
  box.append(cracks);
  await wait(380);
  // 3. brokkelt af: 3×4 stukken, elk een kopie van de kaart met een eigen uitsnede
  const cols = 3;
  const rows = 4;
  const xs = [0, ...Array.from({ length: cols - 1 }, (_, i) => ((i + 1) / cols) * 100 + rnd(-6, 6)), 100];
  const ys = Array.from({ length: rows + 1 }, (_, j) => xs.map((_, i) => (j === 0 ? 0 : j === rows ? 100 : (j / rows) * 100 + (i === 0 || i === cols ? 0 : rnd(-5, 5)))));
  box.remove();
  const falls = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const piece = document.createElement("div");
      piece.className = "stone-box";
      Object.assign(piece.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      piece.style.clipPath = `polygon(${xs[i]}% ${ys[j][i]}%, ${xs[i + 1]}% ${ys[j][i + 1]}%, ${xs[i + 1]}% ${ys[j + 1][i + 1]}%, ${xs[i]}% ${ys[j + 1][i]}%)`;
      piece.style.filter = "grayscale(1) sepia(.35) brightness(.7) contrast(1.2)";
      const g = ghost.cloneNode(true);
      piece.append(g);
      l.append(piece);
      const out = (i - (cols - 1) / 2) * rnd(30, 70);
      falls.push(
        piece.animate(
          [
            { translate: "0 0", rotate: "0deg", opacity: 1 },
            { translate: `${out}px ${rnd(260, 480)}px`, rotate: `${rnd(-70, 70)}deg`, opacity: 0 },
          ],
          { duration: rnd(800, 1100), delay: (rows - j) * 60 + rnd(0, 80), easing: "cubic-bezier(.55,0,.9,.55)", fill: "forwards" }
        ).finished
      );
    }
  }
  // Stofwolk
  const c = { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
  for (let i = 0; i < 18; i++) {
    const d = dot(l, c.x + rnd(-r.width / 2, r.width / 2), c.y + rnd(-r.height / 3, r.height / 3), "dust");
    d.animate([{ scale: 0.4, opacity: 0.8, translate: "0 0" }, { scale: rnd(2, 4), opacity: 0, translate: `${rnd(-60, 60)}px ${rnd(-80, 20)}px` }], {
      duration: rnd(900, 1400),
      easing: "ease-out",
      fill: "forwards",
    });
  }
  const fly = bones({ getBoundingClientRect: () => r }, bank(), boneCount(gained));
  setTimeout(() => countTo(bank(), fossilsBefore, fossilsBefore + gained), 700);
  await Promise.all([fly, ...falls]).catch(() => {});
  l.remove();
  card.style.visibility = "";
}

// Alle dubbele in één keer verstenen: botjes vanaf de knop naar de teller.
export async function bonesToBank(fromEl, gained, fossilsBefore) {
  if (reduced() || !gained) return;
  const fly = bones(fromEl, bank(), boneCount(gained));
  setTimeout(() => countTo(bank(), fossilsBefore, fossilsBefore + gained, 900), 600);
  await fly;
  await wait(250);
}

// Maken: botjes vliegen naar de kaart, de kaart verandert van steen in een levende kaart.
export async function forge(holder, newCard, cost, fossilsBefore) {
  if (!holder) return;
  if (reduced()) return holder.replaceChildren(newCard);
  countTo(bank(), fossilsBefore, fossilsBefore - cost, 600);
  await bones(bank(), holder, boneCount(cost));
  holder.replaceChildren(newCard);
  const l = layer();
  const { x, y } = center(holder);
  const ring = dot(l, x, y, "forge-ring");
  ring.animate([{ scale: 0.3, opacity: 1 }, { scale: 4, opacity: 0 }], { duration: 800, easing: "ease-out", fill: "forwards" });
  for (let i = 0; i < 20; i++) {
    const a = rnd(0, Math.PI * 2);
    dot(l, x, y, "spark").animate([{ translate: "0 0", opacity: 1 }, { translate: `${Math.cos(a) * rnd(80, 200)}px ${Math.sin(a) * rnd(80, 200)}px`, opacity: 0 }], {
      duration: rnd(600, 1000),
      easing: "cubic-bezier(.1,.7,.3,1)",
      fill: "forwards",
    });
  }
  await newCard.animate(
    [
      { filter: "grayscale(1) sepia(.35) brightness(.4) blur(2px)", scale: 0.92 },
      { filter: "grayscale(.3) brightness(1.8)", scale: 1.06, offset: 0.55 },
      { filter: "none", scale: 1 },
    ],
    { duration: 950, easing: "cubic-bezier(.3,.8,.4,1)" }
  ).finished.catch(() => {});
  await wait(500);
  l.remove();
}

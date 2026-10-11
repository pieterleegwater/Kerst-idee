// De kaartenset van seizoen 1: een volledig fictieve competitie.
// Alles is deterministisch, zodat dezelfde kaart-id altijd dezelfde speler is.

export const LEAGUE = "De Polder Liga";
export const SEASON = 1;

export const CLUBS = [
  { id: "molenaar", name: "FC Molenaar", colors: ["#c1121f", "#fdf0d5"] },
  { id: "tulpendam", name: "VV Tulpendam", colors: ["#e85d04", "#1b1b1e"] },
  { id: "kanaal", name: "Kanaal United", colors: ["#023e8a", "#90e0ef"] },
  { id: "duinwijk", name: "SC Duinwijk", colors: ["#e9c46a", "#264653"] },
  { id: "dijkveld", name: "Dijkveld Rovers", colors: ["#2a9d8f", "#ffffff"] },
  { id: "haringstad", name: "Haringstad FC", colors: ["#577590", "#f1faee"] },
  { id: "klompenburg", name: "Klompenburg '09", colors: ["#ffb703", "#023047"] },
  { id: "grachtwijk", name: "Real Grachtwijk", colors: ["#6a040f", "#ffba08"] },
  { id: "hunebed", name: "Atletico Hunebed", colors: ["#3a5a40", "#dad7cd"] },
  { id: "stoomboot", name: "Stoomboot SV", colors: ["#5a189a", "#e0aaff"] },
  { id: "bitterbal", name: "Bitterbal Boys", colors: ["#9c6644", "#ede0d4"] },
  { id: "fietsenrek", name: "Fietsenrek FC", colors: ["#111111", "#80ed99"] },
];

export const RARITIES = {
  brons: { label: "Brons", odds: 0.7 },
  zilver: { label: "Zilver", odds: 0.22 },
  goud: { label: "Goud", odds: 0.07 },
  icoon: { label: "Icoon", odds: 0.01 },
};

const FIRST = ["Daan", "Sem", "Luuk", "Milan", "Jesse", "Bram", "Thijs", "Ruben", "Niels", "Joep", "Stijn", "Koen", "Mats", "Olaf", "Wout", "Jelle", "Teun", "Gijs", "Floris", "Kees", "Hidde", "Pim", "Rik", "Ties", "Bas", "Siem", "Mees", "Youri", "Hamza", "Ilias", "Kenji", "Mateo", "Nordin", "Tobias", "Sven", "Lars", "Ayoub", "Jurre", "Quinten", "Ravi"];
const LAST = ["de Wit", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "Bos", "Vos", "Peters", "Hendriks", "van Dijk", "Dekker", "Brouwer", "de Graaf", "van der Linden", "Kok", "Jacobs", "Vermeulen", "van Leeuwen", "Schouten", "Willems", "Hoekstra", "Koster", "Prins", "Huisman", "Kuipers", "Veenstra", "El Amrani", "Tahiri", "Sanchez", "Okafor", "Nakamura", "Jansma", "Postma", "Wolters", "Zwart", "Groen", "Molenaar", "Dijkstra"];

// Per club 8 kaarten: positie en zeldzaamheid per plek.
const SLOTS = [
  { pos: "AV", rarity: "icoon" },
  { pos: "MID", rarity: "goud" },
  { pos: "AV", rarity: "goud" },
  { pos: "VER", rarity: "zilver" },
  { pos: "MID", rarity: "zilver" },
  { pos: "KEE", rarity: "brons" },
  { pos: "VER", rarity: "brons" },
  { pos: "MID", rarity: "brons" },
];
const RATING = { icoon: [88, 94], goud: [80, 87], zilver: [72, 79], brons: [60, 71] };
const STAT_FOCUS = {
  KEE: { SNE: -14, SCH: -30, PAS: -8, VER: 6 },
  VER: { SNE: -4, SCH: -18, PAS: -6, VER: 6 },
  MID: { SNE: -2, SCH: -4, PAS: 5, VER: -10 },
  AV: { SNE: 4, SCH: 5, PAS: -6, VER: -25 },
};

function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function buildCatalog() {
  const rand = seeded(`${LEAGUE}-${SEASON}`);
  const used = new Set();
  const cards = [];
  let number = 1;
  for (const club of CLUBS) {
    SLOTS.forEach((slot, i) => {
      let name;
      do name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
      while (used.has(name));
      used.add(name);
      const [lo, hi] = RATING[slot.rarity];
      const rating = lo + Math.floor(rand() * (hi - lo + 1));
      const stats = Object.fromEntries(
        Object.entries(STAT_FOCUS[slot.pos]).map(([k, d]) => [k, Math.max(20, Math.min(99, rating + d + Math.floor(rand() * 9) - 4))])
      );
      cards.push({ id: `${club.id}-${i + 1}`, number: number++, name, club: club.id, pos: slot.pos, rarity: slot.rarity, rating, stats, look: Math.floor(rand() * 1e6) });
    });
  }
  return cards;
}

export const CARDS = buildCatalog();
export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const BY_RARITY = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, CARDS.filter((c) => c.rarity === r)]));

export const PACK_SIZE = 5;

// Trek een pakje. `random` geeft [0,1); in productie crypto-random.
// De laatste kaart is altijd minimaal Zilver.
export function drawPack(random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const rollRarity = (minZilver) => {
    let r = random();
    const order = ["icoon", "goud", "zilver", "brons"];
    const odds = minZilver ? { icoon: 0.03, goud: 0.2, zilver: 0.77, brons: 0 } : Object.fromEntries(order.map((k) => [k, RARITIES[k].odds]));
    for (const k of order) {
      if (r < odds[k]) return k;
      r -= odds[k];
    }
    return minZilver ? "zilver" : "brons";
  };
  return Array.from({ length: PACK_SIZE }, (_, i) => pick(BY_RARITY[rollRarity(i === PACK_SIZE - 1)]).id);
}

export const PUBLISHED_ODDS = {
  perKaart: Object.fromEntries(Object.entries(RARITIES).map(([k, v]) => [k, v.odds])),
  laatsteKaart: { icoon: 0.03, goud: 0.2, zilver: 0.77, brons: 0 },
};

export function cryptoRandom() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

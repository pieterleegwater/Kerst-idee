// De kaartenset van seizoen 1: 96 eigen dino's verdeeld over 6 rijken.
// De soorten zijn echte prehistorische dieren (geen merk van iemand); namen, rijken en tekeningen zijn van ons.
// Alles is deterministisch, zodat dezelfde kaart-id altijd dezelfde dino is.

export const GAME_NAME = "DinoRijk";
export const SEASON = 1;

export const GROUPS = [
  { id: "vuur", legend: "Rex", name: "Vulkaanrijk", colors: ["#d00000", "#ffba08"], prefixes: ["Magma", "Lava", "Sintel", "Vlam", "Gloed", "As"], title: "Vulkaankoning", favor: ["theropod", "ceratops", "stego"] },
  { id: "ijs", legend: "Titan", name: "IJstijdrijk", colors: ["#0077b6", "#caf0f8"], prefixes: ["Vorst", "IJs", "Sneeuw", "Gletsjer", "Rijp", "Kristal"], title: "IJskeizer", favor: ["sauropod", "stego", "ceratops"] },
  { id: "jungle", legend: "Brachio", name: "Oerwoudrijk", colors: ["#2d6a4f", "#b7e4c7"], prefixes: ["Varen", "Mos", "Liaan", "Wortel", "Blad", "Doorn"], title: "Oerwoudvorst", favor: ["sauropod", "theropod", "stego"] },
  { id: "oceaan", legend: "Mosa", name: "Diepzeerijk", colors: ["#03045e", "#48cae4"], prefixes: ["Golf", "Koraal", "Diep", "Tij", "Parel", "Branding"], title: "Diepzeetitan", favor: ["zee", "zee", "theropod"] },
  { id: "storm", legend: "Quetzal", name: "Stormrijk", colors: ["#5a189a", "#e0aaff"], prefixes: ["Donder", "Bliksem", "Wervel", "Storm", "Vonk", "Orkaan"], title: "Stormheerser", favor: ["ptero", "ptero", "theropod"] },
  { id: "schaduw", legend: "Raptor", name: "Maanrijk", colors: ["#1b1b3a", "#9d8df1"], prefixes: ["Maan", "Nacht", "Schim", "Nevel", "Eclips", "Raaf"], title: "Maanvorst", favor: ["theropod", "ptero", "ceratops"] },
];

// Bouwtype bepaalt de tekening en de sterke punten.
export const TYPES = {
  theropod: { label: "Vleeseter", code: "VLE", focus: { AAN: 8, VER: -8, SNE: 4, LEV: -2 } },
  sauropod: { label: "Langnek", code: "LNK", focus: { AAN: -10, VER: 2, SNE: -12, LEV: 12 } },
  ceratops: { label: "Hoornkop", code: "HRN", focus: { AAN: 3, VER: 6, SNE: -6, LEV: 2 } },
  stego: { label: "Pantser", code: "PAN", focus: { AAN: -4, VER: 12, SNE: -10, LEV: 4 } },
  ptero: { label: "Vlieger", code: "VLG", focus: { AAN: 0, VER: -10, SNE: 12, LEV: -6 } },
  zee: { label: "Zeereptiel", code: "ZEE", focus: { AAN: 5, VER: -2, SNE: 6, LEV: 0 } },
};

// Echte soorten met een kort, kloppend weetje.
export const SPECIES = [
  { nick: "Rex", type: "theropod", species: "Tyrannosaurus", fact: "Leefde zo'n 68 tot 66 miljoen jaar geleden in Noord-Amerika." },
  { nick: "Raptor", type: "theropod", species: "Velociraptor", fact: "Was ongeveer zo groot als een kalkoen en had veren." },
  { nick: "Spino", type: "theropod", species: "Spinosaurus", fact: "Had een groot zeil op zijn rug en at waarschijnlijk veel vis." },
  { nick: "Allo", type: "theropod", species: "Allosaurus", fact: "Jaagde zo'n 150 miljoen jaar geleden, in het Jura." },
  { nick: "Carno", type: "theropod", species: "Carnotaurus", fact: "Had twee hoorntjes boven zijn ogen. De naam betekent 'vleesetende stier'." },
  { nick: "Dilo", type: "theropod", species: "Dilophosaurus", fact: "Had twee dunne kammen bovenop zijn kop." },
  { nick: "Brachio", type: "sauropod", species: "Brachiosaurus", fact: "Kon met zijn lange nek bij hoge boomtoppen." },
  { nick: "Diplo", type: "sauropod", species: "Diplodocus", fact: "Werd zo'n 25 meter lang, vooral door zijn enorme staart." },
  { nick: "Titan", type: "sauropod", species: "Argentinosaurus", fact: "Een van de grootste dieren die ooit op het land hebben geleefd." },
  { nick: "Tri", type: "ceratops", species: "Triceratops", fact: "Had drie hoorns en een grote nekkraag." },
  { nick: "Styraco", type: "ceratops", species: "Styracosaurus", fact: "Had lange stekels rondom zijn nekkraag." },
  { nick: "Pachy", type: "ceratops", species: "Pachyrhinosaurus", fact: "Had een dikke knobbel op zijn neus in plaats van een hoorn." },
  { nick: "Stego", type: "stego", species: "Stegosaurus", fact: "Had grote platen op zijn rug en stekels aan zijn staart." },
  { nick: "Anky", type: "stego", species: "Ankylosaurus", fact: "Was gepantserd als een tank en had een knots aan zijn staart." },
  { nick: "Kentro", type: "stego", species: "Kentrosaurus", fact: "Een kleinere, stekelige neef van Stegosaurus uit Tanzania." },
  { nick: "Ptera", type: "ptero", species: "Pteranodon", fact: "Geen dinosaurus maar een pterosaurus: een vliegend reptiel." },
  { nick: "Quetzal", type: "ptero", species: "Quetzalcoatlus", fact: "Had een spanwijdte van zo'n 10 meter, groter dan veel kleine vliegtuigjes." },
  { nick: "Mosa", type: "zee", species: "Mosasaurus", fact: "Geen dinosaurus maar een zeereptiel. Het eerste fossiel werd gevonden bij Maastricht!" },
  { nick: "Plesio", type: "zee", species: "Plesiosaurus", fact: "Zwom met vier grote peddels en had een lange nek." },
];

export const RARITIES = {
  brons: { label: "Gewoon", odds: 0.7 },
  zilver: { label: "Zeldzaam", odds: 0.22 },
  goud: { label: "Episch", odds: 0.07 },
  icoon: { label: "Legendarisch", odds: 0.01 },
};

// Per rijk 16 kaarten: 1 legendarisch, 3 episch, 4 zeldzaam, 8 gewoon.
const RARITY_SLOTS = ["icoon", "goud", "goud", "goud", "zilver", "zilver", "zilver", "zilver", "brons", "brons", "brons", "brons", "brons", "brons", "brons", "brons"];
const POWER = { icoon: [88, 95], goud: [80, 87], zilver: [70, 79], brons: [55, 69] };

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
  const rand = seeded(`${GAME_NAME}-${SEASON}`);
  const used = new Set();
  const cards = [];
  let number = 1;
  for (const group of GROUPS) {
    RARITY_SLOTS.forEach((rarity, i) => {
      let sp;
      let name;
      if (rarity === "icoon") {
        sp = SPECIES.find((x) => x.nick === group.legend);
        name = `${group.title} ${sp.nick}`;
      } else do {
        // Ieder rijk heeft voorkeurstypes, maar af en toe zit er een ander type tussen.
        const wantType = rand() < 0.75 ? group.favor[Math.floor(rand() * group.favor.length)] : null;
        const pool = wantType ? SPECIES.filter((s) => s.type === wantType) : SPECIES;
        sp = pool[Math.floor(rand() * pool.length)];
        name = `${group.prefixes[Math.floor(rand() * group.prefixes.length)]}-${sp.nick.toLowerCase()}`;
        name = name.charAt(0).toUpperCase() + name.slice(1);
      } while (used.has(name));
      used.add(name);
      const [lo, hi] = POWER[rarity];
      const rating = lo + Math.floor(rand() * (hi - lo + 1));
      const stats = Object.fromEntries(
        Object.entries(TYPES[sp.type].focus).map(([k, d]) => [k, Math.max(15, Math.min(99, rating + d + Math.floor(rand() * 9) - 4))])
      );
      cards.push({
        id: `${group.id}-${i + 1}`,
        number: number++,
        name,
        group: group.id,
        type: sp.type,
        pos: TYPES[sp.type].code,
        species: sp.species,
        fact: sp.fact,
        rarity,
        rating,
        stats,
        look: Math.floor(rand() * 1e6),
      });
    });
  }
  return cards;
}

export const CARDS = buildCatalog();
export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const BY_RARITY = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, CARDS.filter((c) => c.rarity === r)]));

export const PACK_SIZE = 5;
const LAST_CARD_ODDS = { icoon: 0.03, goud: 0.2, zilver: 0.77, brons: 0 };

// Trek een pakje. `random` geeft [0,1); in productie crypto-random.
// De laatste kaart is altijd minimaal Zeldzaam.
export function drawPack(random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const order = ["icoon", "goud", "zilver", "brons"];
  const rollRarity = (last) => {
    const odds = last ? LAST_CARD_ODDS : Object.fromEntries(order.map((k) => [k, RARITIES[k].odds]));
    let r = random();
    for (const k of order) {
      if (r < odds[k]) return k;
      r -= odds[k];
    }
    return last ? "zilver" : "brons";
  };
  return Array.from({ length: PACK_SIZE }, (_, i) => pick(BY_RARITY[rollRarity(i === PACK_SIZE - 1)]).id);
}

export const PUBLISHED_ODDS = {
  perKaart: Object.fromEntries(Object.entries(RARITIES).map(([k, v]) => [k, v.odds])),
  laatsteKaart: LAST_CARD_ODDS,
};

export function cryptoRandom() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

// Tekent elke dino als SVG op basis van soort, rijk en een vast "look"-getal.
// Geen plaatjes van anderen: alles wordt hier gegenereerd.

const BODY = {
  vuur: ["#e85d04", "#c1121f", "#f48c06"],
  ijs: ["#90e0ef", "#bde0fe", "#5e9ed6"],
  jungle: ["#52b788", "#40916c", "#95d5b2"],
  oceaan: ["#0096c7", "#00b4d8", "#2a6f97"],
  storm: ["#9d4edd", "#7b2cbf", "#c77dff"],
  schaduw: ["#6c63ff", "#4a4e69", "#a29bfe"],
};
const BELLY = { vuur: "#ffd166", ijs: "#ffffff", jungle: "#d8f3dc", oceaan: "#caf0f8", storm: "#f3d9ff", schaduw: "#dcd6ff" };
const EYES = ["#ffb703", "#e63946", "#80ed99", "#4cc9f0", "#f72585"];
const O = "#161616";
const S = `stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`;

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const eye = (x, y, color, r = 2.8) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S}/><circle cx="${x + 0.6}" cy="${y}" r="${r * 0.5}" fill="${color}"/><circle cx="${x + 0.9}" cy="${y - 0.4}" r="${r * 0.18}" fill="#000"/>`;
const leg = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${fill}" ${S}/>`;

// Vlekken of strepen over een gebied (cx, cy, rx, ry).
function markings(r, accent, cx, cy, rx, ry) {
  const kind = Math.floor(r() * 3);
  if (kind === 0) return "";
  let out = "";
  for (let i = 0; i < 5; i++) {
    const x = cx - rx * 0.6 + r() * rx * 1.2;
    const y = cy - ry * 0.6 + r() * ry * 0.7;
    out += kind === 1 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5 + r() * 2.2).toFixed(1)}" fill="${accent}" opacity=".55"/>` : `<path d="M${x.toFixed(1)} ${(y - 4).toFixed(1)} q2 4 0 8" stroke="${accent}" stroke-width="2.2" fill="none" opacity=".6" stroke-linecap="round"/>`;
  }
  return out;
}

const DRAW = {
  theropod(c, b, a, e, r, sp) {
    const sail = sp === "Spinosaurus" ? `<path d="M36 46 Q50 12 68 42Z" fill="${a}" ${S}/><path d="M44 40 L48 22 M52 40 L54 18 M60 41 L60 24" stroke="${O}" stroke-width="1" opacity=".5"/>` : "";
    const crest = sp === "Dilophosaurus" ? `<path d="M84 30 Q86 14 98 24 M90 29 Q94 14 104 26" fill="none" stroke="${a}" stroke-width="3.2" stroke-linecap="round"/>` : "";
    const horns = sp === "Carnotaurus" ? `<path d="M90 29 L86 20 L94 27Z M96 29 L96 19 L100 28Z" fill="${a}" ${S}/>` : "";
    const feathers = sp === "Velociraptor" ? `<path d="M10 46 l-6 -4 M14 45 l-5 -6 M18 44 l-3 -7 M70 52 l4 8 M74 52 l5 7" stroke="${a}" stroke-width="2.4" stroke-linecap="round"/>` : "";
    return `${sail}
      <path d="M6 46 Q26 38 46 43 L48 57 Q28 55 6 49Z" fill="${c}" ${S}/>${feathers}
      ${leg(62, 58, 8, 21, c)}
      <ellipse cx="55" cy="52" rx="20" ry="13" fill="${c}" ${S}/>
      <path d="M40 58 Q55 70 70 58 Q55 63 40 58Z" fill="${b}"/>
      ${markings(r, a, 55, 50, 18, 10)}
      <ellipse cx="51" cy="60" rx="8" ry="10" fill="${c}" ${S}/>
      <path d="M48 66 L46 80 L58 80 L55 66Z" fill="${c}" ${S}/>
      <path d="M66 46 Q71 30 86 28 L104 30 Q113 34 109 40 L97 42 L107 44 Q105 51 92 51 L80 52 Q72 55 67 55Z" fill="${c}" ${S}/>
      <path d="M95 41.5 l2 3 l2 -3 l2 3 l2 -3 l2 3" fill="none" stroke="#fff" stroke-width="1.3"/>
      ${crest}${horns}
      ${eye(93, 34, e)}<circle cx="106" cy="33" r=".9" fill="${O}"/>
      <path d="M71 55 Q77 57 79 62" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  },
  sauropod(c, b, a, e, r) {
    return `<path d="M33 52 Q12 48 2 62 Q16 59 33 63Z" fill="${c}" ${S}/>
      ${leg(38, 60, 8, 19, c)}${leg(64, 60, 8, 19, c)}
      <ellipse cx="52" cy="54" rx="25" ry="15" fill="${c}" ${S}/>
      <path d="M32 62 Q52 74 74 62 Q52 67 32 62Z" fill="${b}"/>
      ${markings(r, a, 52, 50, 22, 11)}
      ${leg(45, 62, 9, 18, c)}${leg(71, 61, 9, 19, c)}
      <path d="M66 47 Q78 18 97 11 L104 17 Q89 26 79 58Z" fill="${c}" ${S}/>
      <ellipse cx="102" cy="14" rx="9" ry="5.5" fill="${c}" ${S}/>
      <path d="M104 17 L110 16" stroke="${O}" stroke-width="1.2"/>
      ${eye(103, 12, e, 2.2)}`;
  },
  ceratops(c, b, a, e, r, sp) {
    const spikes = sp === "Styracosaurus" ? `<path d="M76 34 L68 22 L80 30Z M82 29 L80 14 L88 28Z M90 30 L94 15 L95 31Z" fill="${a}" ${S}/>` : "";
    const nose = sp === "Pachyrhinosaurus" ? `<ellipse cx="104" cy="49" rx="5" ry="3.5" fill="${a}" ${S}/>` : `<path d="M103 50 L109 41 L107 52Z" fill="#f8f9fa" ${S}/>`;
    const brow = sp === "Triceratops" ? `<path d="M89 45 L106 31 L93 47Z M94 46 L110 34 L97 48Z" fill="#f8f9fa" ${S}/>` : "";
    return `<path d="M30 55 Q14 55 7 64 Q20 62 32 62Z" fill="${c}" ${S}/>
      ${leg(36, 62, 8, 17, c)}${leg(62, 62, 8, 17, c)}
      <ellipse cx="50" cy="56" rx="24" ry="14" fill="${c}" ${S}/>
      <path d="M30 63 Q50 73 70 63 Q50 67 30 63Z" fill="${b}"/>
      ${markings(r, a, 50, 52, 20, 10)}
      ${leg(42, 63, 9, 16, c)}${leg(66, 63, 9, 16, c)}
      ${spikes}
      <path d="M72 54 Q68 28 86 28 Q98 30 94 54Z" fill="${a}" ${S}/>
      <path d="M78 52 Q86 40 98 46 L110 54 Q109 63 98 63 L82 63Z" fill="${c}" ${S}/>
      <path d="M108 54 L115 58 L108 61Z" fill="${O}"/>
      ${brow}${nose}
      ${eye(94, 51, e, 2.4)}`;
  },
  stego(c, b, a, e, r, sp) {
    const anky = sp === "Ankylosaurus";
    let back = "";
    if (anky) {
      for (let i = 0; i < 6; i++) back += `<circle cx="${32 + i * 8}" cy="${45 + Math.abs(i - 2.5) * 1.6}" r="3.6" fill="${a}" ${S}/>`;
    } else {
      const thin = sp === "Kentrosaurus";
      for (let i = 0; i < 5; i++) {
        const x = 34 + i * 9;
        const h = 14 + (2 - Math.abs(i - 2)) * 5;
        back += thin ? `<path d="M${x - 2} 46 L${x} ${44 - h} L${x + 2} 46Z" fill="${a}" ${S}/>` : `<path d="M${x - 5} 47 L${x} ${44 - h} L${x + 5} 47Z" fill="${a}" ${S}/>`;
      }
    }
    const tailEnd = anky ? `<ellipse cx="6" cy="47" rx="6" ry="5" fill="${a}" ${S}/>` : `<path d="M9 47 L1 40 M12 49 L6 39 M8 52 L0 52" stroke="${a}" stroke-width="2.6" stroke-linecap="round"/>`;
    return `${back}
      <path d="M30 55 Q15 52 5 45 L8 54 Q18 62 32 62Z" fill="${c}" ${S}/>${tailEnd}
      ${leg(38, 62, 8, 17, c)}${leg(64, 62, 8, 17, c)}
      <ellipse cx="54" cy="56" rx="26" ry="14" fill="${c}" ${S}/>
      <path d="M32 63 Q54 73 76 63 Q54 67 32 63Z" fill="${b}"/>
      ${markings(r, a, 54, 53, 22, 9)}
      ${leg(45, 63, 9, 16, c)}${leg(70, 63, 9, 16, c)}
      <path d="M76 54 Q84 54 88 58 L84 64 Q80 62 76 62Z" fill="${c}" ${S}/>
      <ellipse cx="90" cy="62" rx="9" ry="5.5" fill="${c}" ${S}/>
      ${eye(92, 60, e, 2)}`;
  },
  ptero(c, b, a, e, r, sp) {
    const quetzal = sp === "Quetzalcoatlus";
    const head = quetzal
      ? `<path d="M68 44 Q80 34 84 26" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M68 44 Q80 34 84 26" stroke="${O}" stroke-width="1" fill="none" opacity=".4"/>
         <path d="M80 24 Q88 18 92 24 L116 34 L90 30Z" fill="${c}" ${S}/><path d="M84 22 L80 12 L90 22Z" fill="${a}" ${S}/>${eye(88, 24, e, 2)}`
      : `<path d="M66 42 Q76 36 84 40 L112 44 L84 48 Q74 50 66 48Z" fill="${c}" ${S}/><path d="M70 40 L52 28 L72 44Z" fill="${a}" ${S}/>${eye(78, 42, e, 2.2)}`;
    return `<path d="M62 44 Q76 16 104 6 Q96 28 72 52Z" fill="${a}" opacity=".7" ${S}/>
      <ellipse cx="58" cy="48" rx="14" ry="7" fill="${c}" ${S}/>
      <path d="M48 52 Q58 56 68 51" stroke="${b}" stroke-width="3" fill="none"/>
      <path d="M58 46 Q42 18 12 10 Q22 32 44 54Z" fill="${c}" ${S}/>
      <path d="M58 46 Q42 22 16 13" stroke="${O}" stroke-width="1" fill="none" opacity=".4"/>
      <path d="M50 54 L46 64 M56 55 L54 65" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
      ${head}`;
  },
  zee(c, b, a, e, r, sp) {
    if (sp === "Plesiosaurus") {
      return `<ellipse cx="44" cy="62" rx="12" ry="4" fill="${c}" transform="rotate(25 44 62)" ${S}/>
        <path d="M22 56 Q12 56 6 62 Q14 62 24 61Z" fill="${c}" ${S}/>
        <ellipse cx="48" cy="56" rx="24" ry="10" fill="${c}" ${S}/>
        <path d="M28 60 Q48 68 70 60 Q48 63 28 60Z" fill="${b}"/>
        ${markings(r, a, 48, 54, 20, 7)}
        <ellipse cx="64" cy="64" rx="12" ry="4" fill="${c}" transform="rotate(20 64 64)" ${S}/>
        <path d="M64 50 Q84 40 90 20 L97 22 Q92 46 72 60Z" fill="${c}" ${S}/>
        <ellipse cx="98" cy="20" rx="8" ry="4.5" fill="${c}" ${S}/>
        ${eye(99, 18, e, 2)}`;
    }
    return `<path d="M16 54 L3 40 L8 54 L3 68Z" fill="${a}" ${S}/>
      <ellipse cx="52" cy="62" rx="11" ry="4" fill="${c}" transform="rotate(30 52 62)" ${S}/>
      <path d="M14 52 Q40 36 80 41 Q101 43 112 50 Q102 59 82 58 Q42 66 14 56Z" fill="${c}" ${S}/>
      <path d="M30 57 Q56 64 84 56 Q56 60 30 57Z" fill="${b}"/>
      ${markings(r, a, 52, 48, 28, 6)}
      <path d="M86 52 L111 50" stroke="${O}" stroke-width="1.3"/>
      <path d="M90 52 l2 3 l2 -3 l2 3 l2 -3 l2 3 l2 -3" fill="none" stroke="#fff" stroke-width="1.2"/>
      <ellipse cx="78" cy="60" rx="11" ry="4" fill="${c}" transform="rotate(25 78 60)" ${S}/>
      ${eye(96, 46, e, 2.4)}`;
  },
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
}

function scene(groupId, colors, r, id, { variant, legendary }) {
  const [c1, c2] = colors;
  const dots = (n, fill, rmax, opacity = 0.8) =>
    Array.from({ length: n }, () => `<circle cx="${(r() * 120).toFixed(1)}" cy="${(r() * 62).toFixed(1)}" r="${(0.5 + r() * rmax).toFixed(1)}" fill="${fill}" opacity="${(opacity * (0.4 + r() * 0.6)).toFixed(2)}"/>`).join("");
  if (variant === "kristal") {
    // Oerkristal: diepzwarte achtergrond vol gekleurde kristalscherven
    const shards = Array.from({ length: 14 }, () => {
      const x = r() * 120, y = r() * 90, w = 6 + r() * 14, h = 14 + r() * 26, t = (r() * 60 - 30).toFixed(0);
      const hue = Math.floor(r() * 360);
      return `<polygon points="${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}" transform="rotate(${t} ${x} ${y})" fill="hsl(${hue} 90% 65%)" opacity="${(0.25 + r() * 0.45).toFixed(2)}"/>`;
    }).join("");
    return `<rect width="120" height="90" fill="#06060f"/><radialGradient id="kc${id}" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="${c2}" stop-opacity=".55"/><stop offset="1" stop-color="#06060f" stop-opacity="0"/></radialGradient>${shards}<rect width="120" height="90" fill="url(#kc${id})"/>`;
  }
  const bg = `<linearGradient id="bg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c1, 0.15)}"/><stop offset=".6" stop-color="${shade(c1, -0.35)}"/><stop offset="1" stop-color="${shade(c1, -0.75)}"/></linearGradient>
    <rect width="120" height="90" fill="url(#bg${id})"/>`;
  const rays = legendary
    ? `<g opacity=".18">${[-38, -18, 0, 18, 38].map((a) => `<polygon points="60,-10 54,95 66,95" fill="#fff" transform="rotate(${a} 60 -10)"/>`).join("")}</g>`
    : "";
  const deco = {
    vuur: `<path d="M58 84 L84 34 L98 34 L124 84Z" fill="${shade(c1, -0.8)}"/><path d="M84 34 Q91 26 98 34 L95 44 Q91 38 87 44Z" fill="${c2}"/><path d="M89 30 Q86 18 92 8" stroke="#555" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"/>${dots(14, c2, 1.3)}`,
    ijs: `<path d="M-4 84 L22 40 L36 58 L56 28 L86 84Z" fill="#e0fbfc" opacity=".28"/><path d="M22 40 L28 50 L18 52Z M56 28 L64 42 L50 44Z" fill="#fff" opacity=".5"/>${dots(22, "#fff", 1.1, 1)}`,
    jungle: `<ellipse cx="6" cy="14" rx="24" ry="7" transform="rotate(35 6 14)" fill="#081c15" opacity=".7"/><ellipse cx="116" cy="20" rx="26" ry="7" transform="rotate(-30 116 20)" fill="#081c15" opacity=".7"/><ellipse cx="108" cy="72" rx="18" ry="5" transform="rotate(-20 108 72)" fill="#1b4332" opacity=".8"/>${dots(8, "#d8f3dc", 0.9, 0.7)}`,
    oceaan: `<path d="M0 26 Q15 21 30 26 T60 26 T90 26 T120 26" stroke="${c2}" stroke-width="1.4" fill="none" opacity=".55"/>${[20, 50, 80].map((x) => `<polygon points="${x},0 ${x - 8},90 ${x + 10},90" fill="#fff" opacity=".05"/>`).join("")}${Array.from({ length: 10 }, () => `<circle cx="${(r() * 120).toFixed(1)}" cy="${(r() * 80).toFixed(1)}" r="${(1 + r() * 2.5).toFixed(1)}" fill="none" stroke="#fff" opacity=".45"/>`).join("")}`,
    storm: `<ellipse cx="24" cy="8" rx="30" ry="9" fill="#000" opacity=".3"/><ellipse cx="96" cy="4" rx="34" ry="9" fill="#000" opacity=".3"/><path d="M88 0 L78 24 L88 24 L74 50 L96 18 L86 18 L96 0Z" fill="#ffd60a"/><path d="M88 0 L78 24 L88 24 L74 50 L96 18 L86 18 L96 0Z" fill="none" stroke="#fff8" stroke-width="1"/>`,
    schaduw: `<circle cx="96" cy="18" r="13" fill="#f8f9fa" opacity=".9"/><circle cx="101" cy="15" r="11" fill="${shade(c1, 0.1)}"/>${dots(20, "#fff", 0.8, 1)}`,
  }[groupId];
  const vignette = `<radialGradient id="vg${id}" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>`;
  return bg + rays + deco + vignette;
}

/**
 * @param {object} card  kaart uit de catalogus
 * @param {object} group het rijk
 * @param {{ variant?: string, silhouette?: boolean }} opts
 */
export function dinoSvg(card, group, { variant = "normaal", silhouette = false } = {}) {
  const r = rng(card.look + 7);
  const palette = BODY[card.group];
  const base = palette[Math.floor(r() * palette.length)];
  const accent = group.colors[1];
  const eyeColor = card.rarity === "icoon" || variant === "kristal" ? "#fff200" : EYES[Math.floor(r() * EYES.length)];
  const id = `${card.number}${variant[0]}${silhouette ? "s" : ""}`;
  const flying = card.type === "ptero";
  const swimming = card.type === "zee";
  const glow = !silhouette && (card.rarity === "icoon" || ["goud", "prisma", "kristal"].includes(variant));
  const glowColor = variant === "goud" ? "#ffd166" : variant === "kristal" ? "#7df9ff" : accent;
  const defs = `<defs>
    <radialGradient id="bd${id}" cx=".35" cy=".25" r=".95"><stop offset="0" stop-color="${shade(base, 0.45)}"/><stop offset=".5" stop-color="${base}"/><stop offset="1" stop-color="${shade(base, -0.45)}"/></radialGradient>
    ${glow ? `<filter id="gl${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="2.4" flood-color="${glowColor}" flood-opacity=".95"/></filter>` : ""}
  </defs>`;
  const back = silhouette
    ? `<rect width="120" height="90" fill="#120c07"/><circle cx="60" cy="48" r="38" fill="${group.colors[0]}" opacity=".18"/>`
    : scene(card.group, group.colors, r, id, { variant, legendary: card.rarity === "icoon" });
  const ground = flying || swimming ? "" : `<ellipse cx="58" cy="81" rx="42" ry="5" fill="#000" opacity=".4"/>`;
  const dino = DRAW[card.type](`url(#bd${id})`, BELLY[card.group], accent, eyeColor, r, card.species);
  const shift = flying ? 8 : swimming ? 4 : 0;
  const vignette = silhouette || variant === "kristal" ? "" : `<rect width="120" height="90" fill="url(#vg${id})"/>`;
  // Full-art (Prisma, Oerkristal): vierkantere uitsnede zodat de hele dino in beeld blijft.
  const full = variant === "prisma" || variant === "kristal";
  const viewBox = full ? "-4 -20 128 128" : "0 0 120 90";
  const base0 = full ? `<rect x="-4" y="-20" width="128" height="128" fill="${variant === "kristal" ? "#06060f" : shade(group.colors[0], 0.1)}"/>` : "";
  return `<svg class="dart${silhouette ? " silhouette" : ""}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${defs}${base0}${back}${vignette}${ground}
    <g class="dino" transform="translate(0 ${shift})" ${glow ? `filter="url(#gl${id})"` : ""}>${dino}</g>
  </svg>`;
}

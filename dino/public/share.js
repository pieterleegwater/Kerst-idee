// Maakt een deelplaatje (1080×1920, Story/TikTok-formaat) van een kaart en opent het deelmenu van de telefoon.
// TikTok en Instagram hebben geen web-deellink; via het deelmenu (Web Share API) kies je de app zelf.
import { dinoSvg } from "./art.js";

const W = 1080;
const H = 1920;
const FRAMES = {
  brons: ["#f3c79b", "#a0623a", "#6b3d1f", "#d99a63"],
  zilver: ["#ffffff", "#9aa5ad", "#5f6b73", "#e3e8ec"],
  goud: ["#fff3b0", "#e0a500", "#9a6b00", "#ffe27a"],
  icoon: ["#ffd1ff", "#b14aed", "#5b2a86", "#ff8ad8"],
};
const VARIANT_FRAMES = {
  goud: ["#fffbe0", "#ffd34d", "#b8860b", "#fff1a8"],
  prisma: ["#ff0080", "#ffe600", "#00ff85", "#00cfff", "#8a2be2"],
  kristal: ["#7df9ff", "#1a1040", "#ff7df0", "#1a1040", "#fff27d"],
};
const TIER_COLORS = { brons: "#f3c79b", zilver: "#e3e8ec", goud: "#ffd166", icoon: "#f0b3ff" };

// Plaatjes (WebP) in de SVG inline zetten: een SVG die als afbeelding wordt getekend mag zelf niets ophalen.
async function inlineImages(svg) {
  const hrefs = [...new Set([...svg.matchAll(/href="(\/img\/[^"]+)"/g)].map((m) => m[1]))];
  for (const href of hrefs) {
    const blob = await (await fetch(href)).blob();
    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
    svg = svg.split(`href="${href}"`).join(`href="${dataUrl}"`);
  }
  return svg;
}

async function svgToImage(svg, w, h) {
  const sized = svg.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" `);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([await inlineImages(sized)], { type: "image/svg+xml" }));
  await img.decode();
  return img;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function gradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function fitText(ctx, text, maxWidth, size, font) {
  let s = size;
  do ctx.font = `${font} ${s}px Oswald, Impact, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && (s -= 2) > 20);
}

export async function renderShareImage({ card, group, variant = "normaal", serial = null, catalog }) {
  await Promise.all([document.fonts.load("700 80px Oswald"), document.fonts.load("800 30px Inter")]).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const [c1, c2] = group.colors;

  // Achtergrond: rijkkleur, gloed en sterren
  ctx.fillStyle = gradient(ctx, 0, 0, 0, H, [c1, "#0b0705", "#000000"]);
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 900, 50, W / 2, 900, 800);
  glow.addColorStop(0, `${c2}66`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  let seed = card.number * 97 + 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.2 + rnd() * 0.6;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Kop
  const special = variant !== "normaal" ? catalog.variants[variant].label : card.rarity === "icoon" ? "Legendarisch" : catalog.rarities[card.rarity].label;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbf3e4";
  ctx.font = "700 64px Oswald, Impact, sans-serif";
  ctx.fillText("🦖 DINORIJK", W / 2, 150);
  ctx.font = "800 44px Inter, sans-serif";
  ctx.fillStyle = TIER_COLORS[card.rarity];
  const headline = variant === "kristal" && serial ? `OERKRISTAL #${String(serial).padStart(2, "0")}/${catalog.kristalCap}!` : `${special.toUpperCase()} GEVONDEN!`;
  ctx.fillText(headline, W / 2, 228);

  // Kaart
  const cw = 780;
  const ch = Math.round(cw * 1.4);
  const cx = (W - cw) / 2;
  const cy = 300;
  const frame = VARIANT_FRAMES[variant] || FRAMES[card.rarity];
  ctx.save();
  ctx.shadowColor = variant === "kristal" ? "#7df9ff" : variant === "prisma" ? "#ff00c8" : variant === "goud" ? "#ffd166" : "#000000";
  ctx.shadowBlur = variant === "normaal" || variant === "holo" ? 40 : 90;
  roundRect(ctx, cx, cy, cw, ch, 40);
  ctx.fillStyle = gradient(ctx, cx, cy, cw, ch, frame);
  ctx.fill();
  ctx.restore();
  const b = 26; // rand
  const ix = cx + b;
  const iy = cy + b;
  const iw = cw - 2 * b;
  const ih = ch - 2 * b;
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, 22);
  ctx.clip();
  ctx.fillStyle = variant === "goud" ? gradient(ctx, ix, iy, 0, ih, ["#6e4f00", "#241800"]) : gradient(ctx, ix, iy, iw * 0.4, ih, [c1, "#0b0705"]);
  ctx.fillRect(ix, iy, iw, ih);

  // Tekening
  const full = variant === "prisma" || variant === "kristal";
  const ax = full ? ix : ix + 24;
  const ay = full ? iy : iy + 130;
  const aw = full ? iw : iw - 48;
  const ah = full ? Math.round(ih * 0.78) : Math.round((iw - 48) * 0.75);
  try {
    const art = await svgToImage(dinoSvg(card, group, { variant }), aw * 2, ah * 2);
    ctx.save();
    if (!full) {
      roundRect(ctx, ax, ay, aw, ah, 18);
      ctx.clip();
    }
    ctx.drawImage(art, ax, ay, aw, ah);
    ctx.restore();
    if (full) {
      const fade = ctx.createLinearGradient(0, ay + ah * 0.6, 0, ay + ah);
      fade.addColorStop(0, "transparent");
      fade.addColorStop(1, "#0b0705");
      ctx.fillStyle = fade;
      ctx.fillRect(ax, ay + ah * 0.6, aw, ah * 0.4 + 2);
    }
  } catch (err) {
    console.warn("Tekening kon niet worden gemaakt", err);
  }

  // Glans per afwerking
  const sheen = {
    holo: ["rgba(255,0,128,.0)", "rgba(255,80,80,.35)", "rgba(255,230,0,.35)", "rgba(0,255,140,.35)", "rgba(0,200,255,.35)", "rgba(180,80,255,.35)", "rgba(255,0,128,.0)"],
    goud: ["rgba(255,240,180,0)", "rgba(255,230,140,.45)", "rgba(255,240,180,0)"],
    prisma: ["rgba(255,0,128,.35)", "rgba(255,230,0,.35)", "rgba(0,255,133,.35)", "rgba(0,207,255,.35)", "rgba(138,43,226,.35)"],
    kristal: ["rgba(125,249,255,0)", "rgba(125,249,255,.4)", "rgba(255,125,240,.4)", "rgba(125,249,255,0)"],
  }[variant];
  if (sheen) {
    ctx.globalCompositeOperation = variant === "kristal" ? "screen" : "overlay";
    ctx.fillStyle = gradient(ctx, ix, iy, iw, ih, sheen);
    ctx.fillRect(ix, iy, iw, ih);
    ctx.globalCompositeOperation = "source-over";
  }
  if (card.rarity === "icoon" || full) {
    const shine = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
    shine.addColorStop(0.35, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,.22)");
    shine.addColorStop(0.65, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(ix, iy, iw, ih);
  }

  // Bovenrij: rating, positie, zeldzaamheid
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 112px Oswald, Impact, sans-serif";
  ctx.fillText(String(card.rating), ix + 30, iy + 112);
  const rw = ctx.measureText(String(card.rating)).width;
  ctx.font = "500 40px Oswald, Impact, sans-serif";
  ctx.fillText(card.pos, ix + 50 + rw, iy + 58);
  ctx.font = "800 26px Inter, sans-serif";
  const tier = catalog.rarities[card.rarity].label.toUpperCase();
  const tw = ctx.measureText(tier).width;
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,0,0,.7)";
  roundRect(ctx, ix + 46 + rw, iy + 72, tw + 24, 40, 10);
  ctx.fill();
  ctx.fillStyle = TIER_COLORS[card.rarity];
  ctx.fillText(tier, ix + 58 + rw, iy + 101);
  ctx.textAlign = "right";
  ctx.font = "700 48px Inter, sans-serif";
  ctx.fillText({ brons: "◆", zilver: "◆◆", goud: "◆◆◆", icoon: "★" }[card.rarity], ix + iw - 30, iy + 80);

  // Naamplaat
  const py = full ? iy + ih * 0.66 : ay + ah + 24;
  ctx.fillStyle = full ? "rgba(0,0,0,.65)" : variant === "goud" ? gradient(ctx, 0, py, 0, 130, ["#c99700", "#6e4f00"]) : "rgba(0,0,0,.55)";
  roundRect(ctx, ix + 24, py, iw - 48, 130, 18);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  fitText(ctx, card.name.toUpperCase(), iw - 90, 64, "700");
  ctx.fillText(card.name.toUpperCase(), W / 2, py + 72);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText(`${card.species} · ${group.name}`, W / 2, py + 112);

  // Statistieken
  const sy = py + 150;
  const entries = Object.entries(card.stats);
  const sw = (iw - 48 - 3 * 14) / 4;
  entries.forEach(([k, v], i) => {
    const sx = ix + 24 + i * (sw + 14);
    ctx.fillStyle = variant === "goud" ? gradient(ctx, 0, sy, 0, 110, ["#ffe58a", "#d9a400"]) : "rgba(0,0,0,.5)";
    roundRect(ctx, sx, sy, sw, 110, 16);
    ctx.fill();
    ctx.fillStyle = variant === "goud" ? "#2b1d00" : "#ffffff";
    ctx.font = "700 54px Oswald, Impact, sans-serif";
    ctx.fillText(String(v), sx + sw / 2, sy + 62);
    ctx.font = "800 24px Inter, sans-serif";
    ctx.fillText(k, sx + sw / 2, sy + 96);
  });

  // Voet van de kaart
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.font = "700 26px Inter, sans-serif";
  ctx.fillText(`#${String(card.number).padStart(3, "0")} · S${catalog.season}`, ix + 34, iy + ih - 30);
  ctx.textAlign = "right";
  const tag = variant === "kristal" && serial ? `OERKRISTAL ${String(serial).padStart(2, "0")}/${catalog.kristalCap}` : variant !== "normaal" ? catalog.variants[variant].label.toUpperCase() : "";
  if (tag) ctx.fillText(tag, ix + iw - 34, iy + ih - 30);
  ctx.restore();

  // Onder de kaart
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbf3e4";
  ctx.font = "700 58px Oswald, Impact, sans-serif";
  ctx.fillText("KUN JIJ HEM OOK VANGEN?", W / 2, cy + ch + 130);
  ctx.font = "800 46px Inter, sans-serif";
  ctx.fillStyle = "#ffb703";
  ctx.fillText(location.host || "dinorijk", W / 2, cy + ch + 205);
  ctx.font = "600 30px Inter, sans-serif";
  ctx.fillStyle = "rgba(251,243,228,.75)";
  // Weetje over de echte soort, verdeeld over maximaal twee regels
  const words = card.fact.split(" ");
  const lines = [""];
  for (const w of words) {
    const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
    if (ctx.measureText(test).width > W - 160 && lines[lines.length - 1]) lines.push(w);
    else lines[lines.length - 1] = test;
  }
  lines.slice(0, 2).forEach((line, i) => ctx.fillText(i === 1 && lines.length > 2 ? `${line}…` : line, W / 2, cy + ch + 265 + i * 42));

  return await new Promise((res) => canvas.toBlob(res, "image/png"));
}

// Deelt via het deelmenu van de telefoon (Instagram, TikTok, WhatsApp…). Geeft "shared", "cancelled" of "unsupported".
export async function shareBlob(blob, { fileName, text }) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: "DinoRijk" });
      return "shared";
    } catch (err) {
      return err?.name === "AbortError" ? "cancelled" : "unsupported";
    }
  }
  return "unsupported";
}

export function downloadBlob(blob, fileName) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

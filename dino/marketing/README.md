# DinoRijk advertenties

Kant-en-klaar voor TikTok en Instagram (in `ads/`):

| Bestand | Formaat | Waar |
|---|---|---|
| `dinorijk-ad-1.mp4` | 1080×1920, 12 s | TikTok, Reels, Stories: "POV: je opent je gratis ei" → Prisma Legendarisch |
| `dinorijk-ad-2.mp4` | 1080×1920, 15 s | TikTok, Reels: "Hoe zeldzaam is jouw kaart?" → Oerkristal, maar 25 op de wereld |
| `dinorijk-ad-3.mp4` | 1080×1920, 16 s | TikTok, Reels: "Wist je dat…" echte dino-weetjes |
| `dinorijk-feed.png` | 1080×1350 | Instagram-feed |
| `dinorijk-story.png` | 1080×1920 | Instagram/Facebook Story |

De video's hebben geen geluid: zet er in TikTok/Instagram zelf een populair (trending) geluidje onder.

## Opnieuw maken (na wijzigingen)
De video's worden gemaakt met de echte kaartopmaak uit `public/`.
1. Zet een `catalog.json` in `maker/` (de uitvoer van `https://www.dinorijk.live/api/catalog`).
2. `node maker/srv.mjs maker` (serveert op poort 8791),
3. `node maker/rec.cjs 1 ads` (of `2`, `3`, `feed`, `story`). Vereist Playwright en ffmpeg.

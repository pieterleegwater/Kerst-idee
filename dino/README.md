# 🦖 DinoRijk

Een virtueel verzamelspel met **eigen dinokaarten**: 96 dino's in 6 rijken (Vulkaan, IJstijd, Oerwoud, Diepzee, Storm en Maan).

- **Eigen tekeningen:** elke dino wordt als SVG gegenereerd uit soort, rijk en een vast "look"-getal (`public/art.js`). Er worden geen plaatjes van anderen gebruikt.
- **Echte soorten met kloppende weetjes:** van Tyrannosaurus tot Mosasaurus, waarvan het eerste fossiel bij Maastricht werd gevonden. Namen, rijken en krachten zijn verzonnen. Tik in je album op een kaart voor het weetje.
- **Gratis eieren:** elke 12 uur een ei met 5 kaarten, de laatste is altijd minimaal Zeldzaam.
- **Zeldzaamheden:** Gewoon, Zeldzaam, Episch en Legendarisch (holo), met openbare kansen op `#/regels`.
- **Ruilen met vrienden:** alleen dubbele kaarten, kaart tegen kaart, dezelfde zeldzaamheid, maximaal 5 voorstellen per dag.
- **Seizoenspas** (€4,99 voor 30 dagen) via **Mollie**: elke 6 uur een ei en tot 4 opsparen. De kansen veranderen niet.

Gebouwd op dezelfde motor als `../voetbal` (De Polder Liga) en draait ook gratis op **Cloudflare Workers + D1**.

## Kansspelwet

Kaarten kun je nooit kopen, verkopen of laten uitbetalen. Ruilen is beperkt en de pas koopt geen kaarten of betere kansen. Zo hebben kaarten geen geldwaarde. Dit is een ontwerp om het risico te beperken, geen juridisch advies: **laat het vóór de lancering checken door een kansspeljurist.**

## Gratis online zetten

```bash
npm install
npx wrangler login
npx wrangler d1 create dinorijk          # zet het database_id in wrangler.toml
npm run db:init
npx wrangler secret put MOLLIE_API_KEY    # eerst test_..., later live_...
npm run deploy
```

## Lokaal testen

```bash
npm run db:init:local
npm run dev     # http://localhost:8787 (demo-modus zonder Mollie)
npm test
```

## De set aanpassen

Alles staat in `src/cards.js`: rijken (namen, kleuren, voorvoegsels, legendarische dino), soorten met weetjes en de verdeling van zeldzaamheden. Een nieuw seizoen is een nieuwe `SEASON` met nieuwe rijken of soorten. Bestaande kaart-id's blijven dan geldig zolang je de volgorde niet verandert.

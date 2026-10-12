# 🦖 DinoRijk

Een virtueel verzamelspel met **eigen dinokaarten**: 96 dino's in 6 rijken (Vulkaan, IJstijd, Oerwoud, Diepzee, Storm en Maan).

- **Eigen tekeningen:** elke dino wordt als SVG gegenereerd uit soort, rijk en een vast "look"-getal (`public/art.js`). Er worden geen plaatjes van anderen gebruikt.
- **Echte soorten met kloppende weetjes:** van Tyrannosaurus tot Mosasaurus, waarvan het eerste fossiel bij Maastricht werd gevonden. Namen, rijken en krachten zijn verzonnen. Tik in je album op een kaart voor het weetje.
- **Gratis eieren:** elke 12 uur een ei met 5 kaarten, de laatste is altijd minimaal Zeldzaam.
- **Zeldzaamheden:** Gewoon, Zeldzaam, Episch en Legendarisch, met openbare kansen op `#/regels`.
- **Afwerkingen**, los van de zeldzaamheid gekozen per kaart:

  | Afwerking | Kans per kaart | Waarde × | Te maken met fossielen |
  |---|---|---|---|
  | Normaal | ±90% | ×1 | ja |
  | Holo (regenboogfolie die meebeweegt) | 1 op 13 | ×3 | ja |
  | Goudfolie (goud frame en folie) | 1 op 67 | ×10 | nee, alleen in eieren |
  | Prisma (full-art, draaiende regenboog) | 1 op 333 | ×40 | nee, alleen in eieren |
  | **Oerkristal** (genummerd, bijv. 07/25) | 1 op 5.000 | ×250 | nee, alleen in eieren |

  Van elke dino bestaan wereldwijd maximaal **25 Oerkristal**-exemplaren, en de oplage telt live af. Is hij op, dan wordt de trekking een Prisma. Een Legendarische Oerkristal is dus 1 op een half miljoen kaarten.
- **Verzamelwaarde** in punten (zeldzaamheid × afwerking), voor de lol. Dit heeft geen geldwaarde.
- **Spanning bij het openen:** een kaart met een zeldzame afwerking gloeit al op de achterkant, en bij Goudfolie, Prisma, Oerkristal en Legendarisch volgt een viering op het scherm.
- **Kaarten kantelen** mee met je muis of vinger, en de glans volgt.
- **Eieren kopen** via **Mollie**: 5 voor €3,99, 12 voor €7,99 of 30 voor €17,99. Gekochte eieren hebben exact dezelfde kansen als gratis eieren, en gratis eieren worden eerst uitgebroed.
- **Seizoenspas** (€4,99 voor 30 dagen): elke 6 uur een gratis ei en tot 4 opsparen.
- **Uitgavegrens** van €100 per 30 dagen per account.
- **Accountlimiet** tegen misbruik van gratis eieren: maximaal 3 nieuwe accounts per netwerk (IP-adres) per 24 uur en 60 per uur voor de hele site, plus een onzichtbaar veld tegen bots. IP-adressen worden alleen als hash bewaard en na 30 dagen gewist. De limieten staan in `RULES` in `src/app.js`.
- **Fossielen (Hearthstone-model):** versteen kaarten tot 🦴 fossielen (los of "alle dubbele" in één keer) en maak daarmee de dino die je mist, als Normaal of Holo:

  | | Gewoon | Zeldzaam | Episch | Legendarisch |
  |---|---|---|---|---|
  | Verstenen (Normaal) | 5 | 20 | 100 | 400 |
  | Maken (Normaal) | 40 | 100 | 400 | 1.600 |
  | Maken (Holo) | 160 | 400 | 1.600 | 6.400 |

  Verstenen levert ×4 op voor Holo, ×10 voor Goudfolie en ×40 voor Prisma. Oerkristal kun je niet verstenen.
- **Geen ruilen, geen verkopen, geen uitbetalen.** Met fossielen koop je **nooit** eieren.

Draait op **Netlify + Supabase** (Postgres) of op **Cloudflare Workers + D1**. Dezelfde code werkt op beide.

## Kansspelwet

Dit volgt het model van o.a. Hearthstone: je koopt eieren met geld, maar wat eruit komt kan nooit van eigenaar wisselen of terug naar geld. Concreet:

- Kaarten kun je niet ruilen, verkopen of laten uitbetalen. Er is geen marktplaats.
- Fossielen zijn alleen te gebruiken om kaarten te maken. Ze zijn niet over te dragen, niet in te wisselen voor eieren en niet uit te betalen. Zo kun je "winst" nooit opnieuw inzetten.
- Openbare kansen, en gekochte eieren hebben dezelfde kansen als gratis eieren.
- 18+, en een uitgavegrens van €100 per 30 dagen.

Volgens de Kansspelautoriteit is vooral overdraagbaarheid (en daarmee geldwaarde) bepalend voor of een loot box een kansspel is. Dit is een ontwerp om het risico te beperken, geen juridisch advies: **laat het vóór de lancering checken door een kansspeljurist.**

## Online zetten op Netlify + Supabase

De repo bevat `netlify.toml` (in de hoofdmap), dus Netlify weet zelf dat het om de map `dino/` gaat. Accounts (gebruikersnaam + wachtwoord) regelt het spel zelf. Supabase is de database.

1. **Supabase-verbinding:** open je project op supabase.com → knop **Connect** (bovenaan) → **Transaction pooler** → kopieer de URI (poort 6543) en vervang `[YOUR-PASSWORD]` door je databasewachtwoord.
2. **Netlify → Project configuration → Environment variables:**
   - `SUPABASE_DB_URL` = die URI (markeer hem als geheim)
   - `MOLLIE_API_KEY` = eerst `test_...`, later `live_...`. ⚠️ Zonder deze sleutel is eieren kopen gratis (testmodus).
3. **Repo koppelen:** Project configuration → Build & deploy → Link repository → GitHub → `kerst-idee`, branch `claude/kerst-familiespel`.
4. **Deploys → Trigger deploy.** De tabellen worden bij de eerste aanvraag automatisch aangemaakt.

Veiligheid: de tabellen hebben Row Level Security aan, zonder policies. Via de publieke Supabase-API (met de anon key) kan niemand erbij; alleen de server via `SUPABASE_DB_URL`. De variabelen `SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_KEY` gebruikt het spel niet.

Bestanden voor Netlify:
- `netlify/functions/api.mjs`: alle `/api/*`-verzoeken
- `netlify/functions/cleanup.mjs`: ruimt elke dag verlopen sessies op
- `src/supabase.js` + `src/pg-schema.js`: verbinding en tabellen
- `src/pg.js`: koppelt Postgres aan dezelfde app-code als Cloudflare

## Online zetten op Cloudflare (alternatief)

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
npm test          # draait alle tests op SQLite én op Postgres (PGlite)
```

## De set aanpassen

Alles staat in `src/cards.js`: rijken (namen, kleuren, voorvoegsels, legendarische dino), soorten met weetjes en de verdeling van zeldzaamheden. Een nieuw seizoen is een nieuwe `SEASON` met nieuwe rijken of soorten. Bestaande kaart-id's blijven dan geldig zolang je de volgorde niet verandert.

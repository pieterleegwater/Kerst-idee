# 🎄 Kerstspel op maat

Een website die in 2 minuten een **persoonlijk kerstspel** maakt over jouw familie of team: wie-van-ons, een kerstquiz, raad-het-jaar en opdrachten. Bezoekers zien gratis een voorproefje en betalen €9,95 (familie) of €39 (team) via **Mollie** (iDEAL, Bancontact, creditcard) om het hele spel te ontgrendelen.

Waarom dit idee: zie **[ONDERZOEK.md](ONDERZOEK.md)**.

**Hosting: gratis op Cloudflare Workers.** Commercieel gebruik mag op het gratis plan, er is geen tijdslimiet voor de AI-generatie (die duurt 30–60 sec, te lang voor gratis Vercel of Netlify), en de database (D1) is ook gratis.

## Gratis online zetten (eenmalig, ±15 minuten)

Je hebt [Node.js](https://nodejs.org) en een gratis [Cloudflare-account](https://dash.cloudflare.com/sign-up) nodig.

```bash
npm install
npx wrangler login                      # opent je browser om in te loggen bij Cloudflare
npx wrangler d1 create kerstspel        # maakt de gratis database aan
```

1. Kopieer het `database_id` uit de uitvoer en plak het in `wrangler.toml` (vervang de nullen).
2. Maak de tabel aan en zet je sleutels als geheimen:

```bash
npm run db:init
npx wrangler secret put MOLLIE_API_KEY      # begin met je test_...-sleutel, later live_...
npx wrangler secret put ANTHROPIC_API_KEY   # optioneel, voor echt persoonlijke AI-vragen
npm run deploy
```

Je site staat dan op `https://kerstspel-op-maat.<jouw-naam>.workers.dev`.

**Eigen domein** (bijv. kerstspelopmaat.nl): Cloudflare-dashboard → Workers & Pages → kerstspel-op-maat → Settings → Domains & Routes → *Add custom domain*.

**Mollie:** je hoeft niets in te stellen in het Mollie-dashboard. De site geeft per betaling zelf de webhook en de terugkeer-URL mee. Zorg wel dat iDEAL (en eventueel Bancontact/creditcard) aan staat onder *Betaalmethoden*. Test eerst met je `test_`-sleutel: Mollie toont dan een testpagina waar je "betaald" kunt kiezen.

## Lokaal testen

```bash
npm run db:init:local
npm run dev        # http://localhost:8787
npm test
```

Lokaal werkt het zonder sleutels in **demo-modus**: spellen komen dan uit de ingebouwde sjablonen en de betaalknop ontgrendelt direct. Wil je lokaal met Mollie of AI testen, zet de sleutels dan in een bestand `.dev.vars`:

```
MOLLIE_API_KEY=test_...
ANTHROPIC_API_KEY=sk-ant-...
```

## Wat zit er gratis in?

| Onderdeel | Gratis limiet | Genoeg voor |
|---|---|---|
| Workers-verzoeken | 100.000 per dag | Ruim tienduizenden bezoekers per dag |
| D1-database | 100.000 schrijfacties/dag, 5 GB | ±30.000 spellen per dag |
| Statische pagina's | Onbeperkt | — |

Wordt het een hit en zie je "Worker exceeded CPU" in de logs, dan kost Workers Paid $5 per maand. Mollie rekent per transactie (iDEAL ±€0,29 tot €0,32) en heeft geen vaste kosten.

## Opbouw

- `src/worker.js`: Cloudflare-ingang en nachtelijke opruiming van spellen ouder dan 60 dagen (AVG)
- `src/app.js`: API, voorproefje/betaalmuur, Mollie-betaling en webhook
- `src/mollie.js`: Mollie API v2 via `fetch`
- `src/store.js`: opslag in D1
- `lib/generate.js`: spelgeneratie met Claude, met een sjabloon-fallback
- `public/`: verkooppagina, formulier, spelpagina met spelleider-modus en printversie

## Te doen vóór livegang

- [ ] Privacyverklaring en algemene voorwaarden (je verwerkt gegevens over derden)
- [ ] Bevestigingsmail met de spel-link na betaling
- [ ] Analytics (Cloudflare Web Analytics is gratis)

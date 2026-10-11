# 🎄 Kerstspel op maat

Een website die in 2 minuten een **persoonlijk kerstspel** maakt over jouw familie of team: wie-van-ons, een kerstquiz, raad-het-jaar en opdrachten. Bezoekers zien gratis een voorproefje en betalen €9,95 (familie) of €39 (team) via iDEAL om het hele spel te ontgrendelen.

Waarom dit idee: zie **[ONDERZOEK.md](ONDERZOEK.md)**.

## Lokaal starten

```bash
npm install
npm start          # http://localhost:3000
npm test
```

Zonder sleutels draait alles in **demo-modus**. Spellen worden dan gemaakt met ingebouwde sjablonen en de betaalknop ontgrendelt direct, zonder echte betaling.

## Live zetten

Stel deze omgevingsvariabelen in:

| Variabele | Waarvoor |
|---|---|
| `ANTHROPIC_API_KEY` | AI maakt echt persoonlijke, grappige vragen (anders worden de sjablonen gebruikt) |
| `STRIPE_SECRET_KEY` | Echte betalingen (iDEAL, Bancontact, creditcard). Zet iDEAL aan in je Stripe-dashboard |
| `BASE_URL` | Je domein, bijv. `https://kerstspelopmaat.nl` (nodig voor de terugkeer-link na betalen) |
| `PORT` | Optioneel, standaard 3000 |
| `DATA_DIR` | Optioneel, map waar spellen worden opgeslagen |

Het draait op elke Node-host (Railway, Render, Fly.io of een VPS). Gebruik een persistente schijf voor `DATA_DIR`.

## Opbouw

- `server.js`: API, voorproefje/paywall en Stripe Checkout
- `lib/generate.js`: spelgeneratie met Claude (met een sjabloon-fallback)
- `lib/schema.js`: invoer- en spelstructuur
- `public/`: verkooppagina, formulier, spelpagina met spelleider-modus en printversie

## Te doen vóór livegang

- [ ] Privacyverklaring en algemene voorwaarden (AVG: je verwerkt gegevens over derden)
- [ ] Spellen automatisch verwijderen na ±60 dagen
- [ ] Stripe-webhook als extra zekerheid naast de controle bij terugkeer
- [ ] Bevestigingsmail met de spel-link na betaling
- [ ] Analytics (bijv. Plausible) om conversie te meten

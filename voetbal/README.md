# ⚽ De Polder Liga

Een virtueel verzamelspel met voetbalkaarten voor volwassenen (18+). Alle 96 spelers en 12 clubs zijn verzonnen.

- **Gratis pakjes:** elke 12 uur een pakje van 5 kaarten. De laatste kaart is altijd minimaal Zilver.
- **Zeldzaamheden:** Brons, Zilver, Goud en Icoon (holo), met openbare kansen op `#/regels`.
- **Album** per club met je voortgang.
- **Ruilen met vrienden:** alleen dubbele kaarten, kaart tegen kaart, dezelfde zeldzaamheid, maximaal 5 voorstellen per dag.
- **Verdienmodel:** de Seizoenspas (€4,99 voor 30 dagen) via **Mollie**. Daarmee laden pakjes elke 6 uur op en spaar je er tot 4 op.

Draait gratis op **Cloudflare Workers + D1**, net als het kerstspel.

## Waarom het zo is opgezet (Kansspelwet)

Volgens de Kansspelautoriteit is iets een kansspel als je betaalt voor toeval én de prijs geldwaarde heeft, bijvoorbeeld omdat je hem kunt doorverkopen. Daarom:

- Je kunt **nooit** kaarten kopen, verkopen of laten uitbetalen.
- Ruilen gaat alleen kaart tegen kaart, met dezelfde zeldzaamheid en een daglimiet. Zo is het lastig om kaarten naar één account te sluizen en te verkopen.
- De Seizoenspas koopt geen kaarten en geen betere kansen, alleen sneller gratis pakjes.
- Handel voor geld buiten de site is verboden volgens de regels.

Dit is een ontwerp om het risico te beperken, geen juridisch advies. **Laat het vóór de lancering checken door een kansspeljurist.**

## Gratis online zetten

```bash
npm install
npx wrangler login
npx wrangler d1 create polderliga     # zet het database_id in wrangler.toml
npm run db:init
npx wrangler secret put MOLLIE_API_KEY  # eerst test_..., later live_...
npm run deploy
```

## Lokaal testen

```bash
npm run db:init:local
npm run dev     # http://localhost:8787 (demo-modus zonder Mollie: de pas wordt direct actief)
npm test
```

## Opbouw

- `src/cards.js`: kaartenset, kansen en het trekken van pakjes (crypto-random)
- `src/app.js`: accounts, pakjes, ruilen, seizoenspas en Mollie-webhook
- `schema.sql`: tabellen. De CHECK-constraints zorgen dat je nooit je laatste kaart wegruilt of onder 0 pakjes komt
- `public/`: de site (pakjes openen, album, ruilen, winkel)

## Ideeën voor later

- Wekelijkse uitdagingen ("verzamel alle keepers"), met een beloning in gratis pakjes
- Nieuwe seizoenen en speciale kaarten (kerst-editie, "Speler van de maand")
- Cosmetica te koop: albumthema's en kaarthoesjes, zonder invloed op kansen
- Vriendenlijst en een ranglijst voor de meest complete albums
- Inloggen met e-mail en wachtwoord-reset

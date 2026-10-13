// Privacybeleid en algemene voorwaarden van DinoRijk.
// Vul hier je eigen gegevens in; lege velden worden netjes weggelaten.
export const LEGAL = {
  company: "", // bijv. "Jansen Games" (handelsnaam zoals bij de KvK)
  kvk: "", // KvK-nummer
  address: "", // vestigingsadres
  email: "", // contactadres voor vragen, klachten en privacyverzoeken
  updated: "12 oktober 2026",
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const by = () => (LEGAL.company ? ` van ${esc(LEGAL.company)}` : "");
const contact = () =>
  LEGAL.email
    ? `<a href="mailto:${esc(LEGAL.email)}">${esc(LEGAL.email)}</a>`
    : "het contactadres dat onderaan deze pagina staat zodra het bekend is";
const identity = () =>
  [LEGAL.company && `<b>${esc(LEGAL.company)}</b>`, LEGAL.address && esc(LEGAL.address), LEGAL.kvk && `KvK ${esc(LEGAL.kvk)}`, LEGAL.email && `E-mail: ${contact()}`]
    .filter(Boolean)
    .join("<br>");

function page(title, html) {
  const box = document.createElement("div");
  box.className = "panel legal";
  box.innerHTML = `<h1>${title}</h1><p class="muted">Laatst bijgewerkt: ${LEGAL.updated}</p>${html}${identity() ? `<h2>Contact</h2><p>${identity()}</p>` : ""}`;
  return box;
}

export function privacyHtml() {
  return page(
    "Privacybeleid",
    `
<p>DinoRijk is een online verzamelspel${by()}. Wij gaan zorgvuldig om met je gegevens en verzamelen niet meer dan nodig is om het spel te laten werken. Hieronder lees je precies wat we bewaren, waarom en hoe lang.</p>

<h2>Wat we bewaren en waarom</h2>
<div class="table-scroll"><table class="odds legal-table">
<tr><th>Gegevens</th><th>Waarvoor</th><th>Grondslag</th><th>Hoe lang</th></tr>
<tr><td>Gebruikersnaam, e-mailadres, wachtwoord (alleen als onleesbare hash), aanmaakdatum</td><td>Je account: inloggen en je wachtwoord herstellen</td><td>Uitvoering van de overeenkomst</td><td>Tot je je account verwijdert</td></tr>
<tr><td>Spelgegevens: kaarten, fossielen, eieren, punten</td><td>Het spel zelf</td><td>Uitvoering van de overeenkomst</td><td>Tot je je account verwijdert</td></tr>
<tr><td>Gebruikersnaam, punten en badges op de ranglijst</td><td>De openbare ranglijst. Kies dus een gebruikersnaam die niet je echte naam is.</td><td>Uitvoering van de overeenkomst</td><td>Tot je je account verwijdert</td></tr>
<tr><td>Gebruikersnaam bij een bijzondere vondst (Legendarisch, Goudfolie, Prisma, Oerkristal)</td><td>De openbare live-balk met vondsten</td><td>Uitvoering van de overeenkomst</td><td>7 dagen</td></tr>
<tr><td>Betalingen: betaalnummer, product, bedrag, status, datum</td><td>Aankopen leveren en onze administratie</td><td>Wettelijke plicht (fiscale bewaarplicht)</td><td>7 jaar, ook na het verwijderen van je account (dan zonder naam of e-mail)</td></tr>
<tr><td>Een versleutelde, niet terug te rekenen code van je IP-adres (hash)</td><td>Misbruik voorkomen: maximaal 3 accounts per netwerk per dag, geen beloning voor nep-uitnodigingen vanaf hetzelfde netwerk, en het afremmen van wachtwoord raden</td><td>Gerechtvaardigd belang</td><td>Aanmelden: bij je account tot je het verwijdert (in de limietlijst 30 dagen); inlogpogingen: 1 dag</td></tr>
<tr><td>Wie jou heeft uitgenodigd, en hoeveel vrienden jij hebt uitgenodigd</td><td>De beloning voor vrienden uitnodigen. Je gebruikersnaam staat in je eigen uitnodigingslink.</td><td>Uitvoering van de overeenkomst</td><td>Tot je je account verwijdert</td></tr>
<tr><td>Inlogcookie en wachtwoord-resetlinks</td><td>Ingelogd blijven en je wachtwoord herstellen</td><td>Uitvoering van de overeenkomst</td><td>Cookie 30 dagen; resetlink 60 minuten</td></tr>
</table></div>
<p>Wij slaan <b>geen</b> bank- of kaartgegevens op en we bewaren je IP-adres niet zelf. Je gegevens worden niet verkocht en niet gebruikt voor advertenties.</p>

<h2>Cookies</h2>
<p>DinoRijk gebruikt één cookie: <code>sid</code>, zodat je ingelogd blijft. Dat cookie is noodzakelijk voor het spel. We gebruiken geen tracking-, advertentie- of analysecookies en laden niets van Google of sociale netwerken. Daarom is er geen cookiemelding.</p>

<h2>Wie helpt ons hierbij</h2>
<p>Voor een paar onderdelen werken we met dienstverleners. Met hen zijn (verwerkers)afspraken gemaakt via hun standaardvoorwaarden:</p>
<ul>
<li><b>Netlify</b> (hosting van de website, VS). Netlify kan technische logbestanden bijhouden, zoals IP-adressen. Doorgifte buiten de EU gebeurt op basis van het EU-VS Data Privacy Framework en standaardcontractbepalingen.</li>
<li><b>Supabase</b> (database). Je gegevens staan op servers in de EU (Ierland).</li>
<li><b>Mollie</b> (betalingen, Nederland). Als je betaalt, verwerkt Mollie je betaalgegevens volgens het eigen privacybeleid van Mollie.</li>
<li><b>Resend</b> (versturen van e-mails, zoals resetlinks, VS). Resend krijgt alleen je e-mailadres en de inhoud van die mail.</li>
</ul>

<h2>Leeftijd</h2>
<p>DinoRijk is alleen voor mensen van 18 jaar en ouder. Merken we dat een account van iemand jonger is, dan verwijderen we het.</p>

<h2>Beveiliging</h2>
<p>De verbinding is altijd versleuteld (https). Wachtwoorden bewaren we alleen als hash (PBKDF2), zodat ook wij ze niet kunnen lezen. Na het wijzigen van je wachtwoord word je overal uitgelogd.</p>

<h2>Jouw rechten</h2>
<p>Je mag je gegevens inzien, laten verbeteren, laten verwijderen of meenemen, en je mag bezwaar maken. Veel kun je zelf regelen op <a href="#/account">Mijn account</a>:</p>
<ul>
<li><b>Gegevens downloaden:</b> al je gegevens in één bestand.</li>
<li><b>Account verwijderen:</b> je gebruikersnaam, e-mailadres, wachtwoord en kaarten worden direct gewist. Alleen betaalgegevens bewaren we nog zonder je naam, omdat de wet dat verplicht.</li>
</ul>
<p>Voor andere verzoeken of vragen kun je mailen naar ${contact()}. We reageren binnen een maand. Ben je niet tevreden over hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener">Autoriteit Persoonsgegevens</a>.</p>

<h2>Wijzigingen</h2>
<p>Als we dit beleid aanpassen, zie je dat aan de datum bovenaan. Bij belangrijke wijzigingen laten we het je in het spel weten.</p>
`
  );
}

export function termsHtml({ pity, passDays }) {
  return page(
    "Algemene voorwaarden",
    `
<p>Deze voorwaarden gelden voor het gebruik van DinoRijk, een online verzamelspel${by()}. Door een account aan te maken ga je ermee akkoord.</p>

<h2>1. Wat DinoRijk is</h2>
<p>In DinoRijk verzamel je virtuele dinokaarten door eieren uit te broeden. Kaarten en fossielen zijn <b>alleen voor gebruik in het spel</b>. Ze hebben geen geldwaarde. Je kunt ze niet verkopen, ruilen, overdragen of laten uitbetalen, en met fossielen koop je geen eieren. Je wordt geen eigenaar van de kaarten: je krijgt een persoonlijk recht om ze in het spel te gebruiken.</p>

<h2>2. Je account</h2>
<ul>
<li>DinoRijk is alleen voor mensen van 18 jaar en ouder.</li>
<li>Eén account per persoon. Houd je wachtwoord geheim; wat er met je account gebeurt, valt onder jouw verantwoordelijkheid.</li>
<li>Geen bots, scripts, misbruik van fouten of meerdere accounts om extra gratis eieren te krijgen. Doe je dat toch, dan mogen we je account blokkeren of verwijderen. Gekochte eieren vervallen dan.</li>
<li>Je kunt je account altijd zelf verwijderen via <a href="#/account">Mijn account</a>. Je kaarten en ongebruikte eieren vervallen dan.</li>
</ul>

<h2>3. Kopen</h2>
<ul>
<li>Je kunt eieren en de Seizoenspas kopen. Alle prijzen staan in euro's, inclusief eventuele btw. Je betaalt via Mollie (bijvoorbeeld iDEAL, Bancontact of creditcard).</li>
<li>Je aankoop staat direct na de betaling in je account.</li>
<li>De Seizoenspas geldt ${passDays} dagen en wordt niet automatisch verlengd.</li>
<li>Gekochte eieren hebben precies dezelfde kansen als gratis eieren. Alle kansen staan op <a href="#/regels">Kansen &amp; regels</a>.</li>
<li>Het Starterspakket kun je één keer per account kopen.</li>
<li>Geluksmeter: in uiterlijk elk ${pity}e ei (gratis of gekocht) zit gegarandeerd een Legendarische kaart.</li>
</ul>

<h2>4. Herroepingsrecht (bedenktijd)</h2>
<p>Bij online aankopen heb je normaal 14 dagen bedenktijd. Eieren en de Seizoenspas zijn digitale inhoud die we direct na betaling leveren. Daarom vragen we je vóór elke aankoop om aan te vinken dat je de aankoop <b>direct</b> wilt ontvangen en dat je daarmee <b>afziet van je herroepingsrecht</b>. Zonder dat vinkje kun je niet kopen. Is er iets misgegaan met een betaling of levering? Neem dan contact met ons op, dan lossen we het op.</p>

<h2>5. Vrienden uitnodigen</h2>
<p>Met je eigen uitnodigingslink kun je vrienden uitnodigen. Maakt iemand via jouw link een account, dan krijgt die een extra ei. Zodra die het eerste ei uitbroedt, krijg jij ook een ei, tot maximaal 10 per 30 dagen. Aanmeldingen vanaf hetzelfde netwerk als jij leveren geen beloning op. Nep-accounts aanmaken om eieren te verdienen is niet toegestaan (zie artikel 2).</p>

<p><b>Opdrachten en verzameldoelen:</b> elke dag zijn er nieuwe opdrachten, en je kunt beloningen verdienen door dino's te verzamelen of een rijk compleet te maken. Elke beloning kun je één keer ophalen. Beloningen hebben net als kaarten geen geldwaarde.</p>

<p><b>Dagelijkse beloning:</b> haal elke dag (Nederlandse tijd) je beloning op. Zeven dagen op rij levert 2 eieren op; mis je een dag, dan begint de reeks opnieuw. Ook hiervoor geldt: één account per persoon.</p>

<h2>6. Het spel kan veranderen</h2>
<p>We werken DinoRijk regelmatig bij, bijvoorbeeld met nieuwe kaarten of seizoenen. We doen ons best om het spel altijd bereikbaar te houden, maar onderhoud of storingen kunnen voorkomen. Stoppen we met DinoRijk, dan laten we dat minstens 30 dagen van tevoren weten.</p>

<h2>7. Aansprakelijkheid</h2>
<p>Als wij aansprakelijk zijn voor schade, dan is dat beperkt tot het bedrag dat je in de 12 maanden daarvoor bij ons hebt betaald. Dit geldt niet bij opzet of grove schuld. Je wettelijke rechten als consument blijven altijd gelden.</p>

<h2>8. Privacy</h2>
<p>Hoe we met je gegevens omgaan, lees je in ons <a href="#/privacy">privacybeleid</a>.</p>

<h2>9. Vragen en klachten</h2>
<p>Heb je een vraag of klacht? Mail naar ${contact()}. We reageren binnen 14 dagen. Op deze voorwaarden is Nederlands recht van toepassing. Komen we er samen niet uit, dan kun je het geschil voorleggen aan de bevoegde Nederlandse rechter.</p>
`
  );
}

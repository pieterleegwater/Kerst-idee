import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GameSchema } from "./schema.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const SYSTEM = `Je bent een ervaren Nederlandse quizmaster en spelontwerper.
Je maakt een persoonlijk kerstspel voor één specifieke groep (familie of collega's) op basis van wat de klant over hen vertelt.

Regels:
- Schrijf in natuurlijk, warm Nederlands. Geen Engelse woorden als er een Nederlands woord voor is.
- Gebruik de echte namen en weetjes. Hoe persoonlijker, hoe beter: dat is waarom de klant betaalt.
- Plagen mag, maar nooit kwetsend: geen grappen over gewicht, uiterlijk, geld, gezondheid, relaties die uit zijn of overleden mensen.
- Verzin geen feiten over personen. Persoonlijke vragen gaan alleen over wat de klant heeft ingevuld; algemene kerstvragen moeten feitelijk kloppen.
- Bij leeftijd "met-jonge-kinderen": houd vragen en opdrachten simpel en geschikt voor kinderen vanaf 6.
- Maak precies 4 rondes:
  1. "wie-van-ons": raad wie bij een weetje hoort (meerkeuze met namen uit de groep), 6-10 vragen.
  2. "quiz": algemene kerstquiz met Nederlandse en internationale kersttradities, films en muziek, 8 vragen, meerkeuze met 4 opties.
  3. "raad-het-jaar": vragen over de hoogtepunten van dit jaar van deze groep, 4-8 vragen. Als er weinig hoogtepunten zijn, maak gecombineerde vragen over weetjes.
  4. "opdracht": 5-6 korte, grappige groepsopdrachten (uitbeelden, neuriën, tekenen) waarin namen voorkomen; options leeg, answer = hoe je punten geeft.
- Het antwoord moet altijd letterlijk één van de opties zijn als er opties zijn.`;

export async function generateGame(input) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return fallbackGame(input);
  }
  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(GameSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: describeInput(input) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("AI gaf geen bruikbaar spel terug (stop_reason=%s), fallback gebruikt", response.stop_reason);
      return fallbackGame(input);
    }
    return { ...response.parsed_output, source: "ai" };
  } catch (err) {
    console.error("AI-generatie mislukt, fallback gebruikt:", err.message);
    return fallbackGame(input);
  }
}

function describeInput(input) {
  const members = input.members
    .map((m) => `- ${m.name}${m.facts ? `: ${m.facts}` : ""}`)
    .join("\n");
  return `Groep: ${input.groupName} (${input.plan === "team" ? "collega's" : "familie/vrienden"})
Moment: ${input.occasion}
Leeftijden: ${input.ages}
Toon: ${input.tone}

Deelnemers en weetjes:
${members}

Hoogtepunten van dit jaar:
${input.yearHighlights || "(niet ingevuld)"}

Tradities / running gags:
${input.traditions || "(niet ingevuld)"}`;
}

// ---------- Fallback zonder AI: werkt altijd, ook zonder API-sleutel ----------

const KERSTQUIZ = [
  { q: "In welk land is de kerstboom-traditie zoals wij die kennen ontstaan?", o: ["Duitsland", "Engeland", "Zweden", "Nederland"], a: "Duitsland" },
  { q: "Hoe heet het rendier met de rode neus?", o: ["Rudolph", "Dasher", "Blitzen", "Comet"], a: "Rudolph" },
  { q: "Welk gerecht staat in Nederland het vaakst op tafel met kerst?", o: ["Gourmet", "Kalkoen", "Fondue", "Rollade"], a: "Gourmet" },
  { q: "In welke film zet een jongetje twee inbrekers voor schut tijdens kerst?", o: ["Home Alone", "Elf", "The Grinch", "Love Actually"], a: "Home Alone" },
  { q: "Wie zong 'All I Want for Christmas Is You'?", o: ["Mariah Carey", "Whitney Houston", "Céline Dion", "Wham!"], a: "Mariah Carey" },
  { q: "Wat is de 'tweede kerstdag' in het Engels?", o: ["Boxing Day", "Gift Day", "Holy Day", "Second Christmas"], a: "Boxing Day" },
  { q: "Hoeveel dagen telt het lied 'The Twelve Days of Christmas'?", o: ["12", "10", "24", "7"], a: "12" },
  { q: "Welke kleur heeft de Grinch?", o: ["Groen", "Rood", "Blauw", "Paars"], a: "Groen" },
  { q: "Uit welk land komt de traditie van het kerststal-figuurtje dat zijn behoefte doet (de 'caganer')?", o: ["Spanje (Catalonië)", "Italië", "Portugal", "België"], a: "Spanje (Catalonië)" },
  { q: "Wat is een 'kerststol' van binnen meestal gevuld met?", o: ["Amandelspijs", "Chocolade", "Jam", "Slagroom"], a: "Amandelspijs" },
  { q: "Welke Wham!-hit gaat over een gebroken hart met kerst?", o: ["Last Christmas", "Wake Me Up", "Freedom", "Careless Whisper"], a: "Last Christmas" },
  { q: "Wat hang je volgens de Engelse traditie op om onder te zoenen?", o: ["Maretak", "Hulst", "Klimop", "Dennentak"], a: "Maretak" },
];

const OPDRACHTEN = [
  (n) => `${n} beeldt een kerstfilm uit zonder te praten. De groep heeft 60 seconden.`,
  (n) => `${n} neuriet een kerstlied. Wie het als eerste raadt, krijgt het punt.`,
  (n) => `${n} tekent in 30 seconden een kerstman met de 'verkeerde' hand.`,
  (n) => `${n} houdt een speech van 20 seconden over het beste moment van dit jaar.`,
  (n) => `${n} doet de anderen na bij het openmaken van een cadeau dat tegenvalt.`,
  (n) => `${n} noemt binnen 15 seconden vijf dingen die rood én eetbaar zijn.`,
];

function seededRandom(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitItems(text) {
  return text
    .split(/[;\n]|\.\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 2);
}

export function fallbackGame(input) {
  const rand = seededRandom(input.groupName + input.members.map((m) => m.name).join());
  const names = input.members.map((m) => m.name);

  const facts = input.members.flatMap((m) => splitItems(m.facts).map((fact) => ({ name: m.name, fact })));
  const wieVanOns = shuffle(facts, rand)
    .slice(0, 10)
    .map(({ name, fact }) => {
      const others = shuffle(names.filter((n) => n !== name), rand).slice(0, 3);
      return {
        question: `Wie van ons: ${fact.charAt(0).toLowerCase()}${fact.slice(1)}?`,
        options: shuffle([name, ...others], rand),
        answer: name,
        hostNote: `Laat ${name} pas na het antwoord vertellen hoe het zit.`,
      };
    });

  const quiz = shuffle(KERSTQUIZ, rand)
    .slice(0, 8)
    .map(({ q, o, a }) => ({ question: q, options: shuffle(o, rand), answer: a, hostNote: "" }));

  const highlights = splitItems(input.yearHighlights);
  const jaar = highlights.slice(0, 8).map((h) => ({
    question: `In welke maand gebeurde dit: "${h}"?`,
    options: [],
    answer: "Iedereen schrijft een maand op. Goed = 2 punten, één maand ernaast = 1 punt.",
    hostNote: "Vraag wie er het meest bij betrokken was om het verhaal kort te vertellen.",
  }));

  const opdrachten = shuffle(OPDRACHTEN, rand)
    .slice(0, 6)
    .map((fn, i) => ({
      question: fn(names[i % names.length]),
      options: [],
      answer: "Gelukt = 2 punten voor het team van de speler.",
      hostNote: "",
    }));

  const rounds = [
    { title: `Wie van ${input.groupName}?`, kind: "wie-van-ons", explanation: "Ik lees een weetje voor. Raad wie van ons erbij hoort!", questions: wieVanOns },
    { title: "De grote kerstquiz", kind: "quiz", explanation: "Algemene kerstkennis. Eén punt per goed antwoord.", questions: quiz },
    { title: "Wat een jaar!", kind: "raad-het-jaar", explanation: "Hoe goed herinneren jullie je dit jaar?", questions: jaar },
    { title: "Kerstopdrachten", kind: "opdracht", explanation: "Tijd om op te staan! Elke opdracht levert punten op.", questions: opdrachten },
  ].filter((r) => r.questions.length > 0);

  return {
    title: `Het grote kerstspel van ${input.groupName}`,
    intro: `Welkom bij het allereerste kerstspel van ${input.groupName}! Vanavond ontdekken we wie elkaar écht het beste kent. Pak pen en papier, maak teams en laat de strijd beginnen.`,
    rounds,
    finale: `Dat was het! Tel de punten op. De winnaar mag zich een jaar lang kampioen van ${input.groupName} noemen en kiest volgend jaar het kerstmenu.`,
    source: "template",
  };
}

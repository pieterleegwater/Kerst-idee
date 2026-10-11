import { z } from "zod/v4";

// Wat de klant invult in het formulier.
export const InputSchema = z.object({
  plan: z.enum(["familie", "team"]).default("familie"),
  groupName: z.string().trim().min(1).max(60),
  occasion: z.enum(["kerstavond", "eerste-kerstdag", "tweede-kerstdag", "kerstborrel", "oud-en-nieuw"]).default("eerste-kerstdag"),
  ages: z.enum(["alle-leeftijden", "volwassenen", "met-jonge-kinderen"]).default("alle-leeftijden"),
  tone: z.enum(["gezellig", "plagerig", "competitief"]).default("gezellig"),
  members: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        facts: z.string().trim().max(300).default(""),
      })
    )
    .min(2)
    .max(40),
  yearHighlights: z.string().trim().max(800).default(""),
  traditions: z.string().trim().max(500).default(""),
});

const Question = z.object({
  question: z.string(),
  options: z.array(z.string()).describe("2-4 antwoordopties bij meerkeuze, anders een lege lijst"),
  answer: z.string(),
  hostNote: z.string().describe("Korte tip of grap voor de spelleider, mag leeg zijn"),
});

const Round = z.object({
  title: z.string(),
  kind: z.enum(["quiz", "wie-van-ons", "opdracht", "raad-het-jaar"]),
  explanation: z.string().describe("Uitleg van de ronde in 1-2 zinnen, voor te lezen door de spelleider"),
  questions: z.array(Question),
});

// Wat de AI (of de fallback) teruggeeft.
export const GameSchema = z.object({
  title: z.string(),
  intro: z.string().describe("Openingstekst die de spelleider voorleest"),
  rounds: z.array(Round),
  finale: z.string().describe("Afsluitende tekst / prijsuitreiking"),
});

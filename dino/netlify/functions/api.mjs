// Netlify Function: alle /api/*-verzoeken van DinoRijk. De statische site staat in public/.
import { getDatabase } from "@netlify/database";
import { createApp } from "../../src/app.js";
import { pgDatabase } from "../../src/pg.js";
import { createMollie } from "../../src/mollie.js";

let app;

export default async (request) => {
  app ??= createApp({
    db: pgDatabase(() => getDatabase().pool), // verbinding pas bij eerste query
    mollie: process.env.MOLLIE_API_KEY ? createMollie(process.env.MOLLIE_API_KEY) : null,
  });
  return app(request);
};

export const config = { path: "/api/*" };

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "kerstspel-"));
delete process.env.ANTHROPIC_API_KEY;
delete process.env.STRIPE_SECRET_KEY;
const { default: app } = await import("../server.js");

const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;
const post = (p, body) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

const input = {
  plan: "familie",
  groupName: "de Jansens",
  members: [
    { name: "Peter", facts: "raakte drie keer de autosleutels kwijt; kan niet tegen spruitjes" },
    { name: "Sanne", facts: "is verhuisd naar Utrecht" },
    { name: "Oma Riet", facts: "won de bingo in het buurthuis" },
    { name: "Kees", facts: "" },
  ],
  yearHighlights: "Opa werd 80\nDe hond at de taart op",
};

after(() => server.close());

test("maakt een spel, toont alleen voorproefje tot betaling", async () => {
  const res = await post("/api/games", input);
  assert.equal(res.status, 200);
  const { id } = await res.json();

  const preview = await (await fetch(`${base}/api/games/${id}`)).json();
  assert.equal(preview.paid, false);
  assert.equal(preview.game.rounds[0].questions.length, 3);
  assert.ok(preview.game.rounds.slice(1).every((r) => r.locked && !r.questions));
  assert.ok(preview.game.lockedQuestions > 0);
  assert.equal(preview.game.finale, undefined);

  for (const q of preview.game.rounds[0].questions) if (q.options.length) assert.ok(q.options.includes(q.answer));

  const checkout = await (await post(`/api/games/${id}/checkout`)).json();
  assert.match(checkout.url, /spel\.html/);
  const full = await (await fetch(`${base}/api/games/${id}`)).json();
  assert.equal(full.paid, true);
  assert.ok(full.game.finale);
  assert.equal(full.game.rounds.length, 4);
});

test("weigert ongeldige invoer", async () => {
  assert.equal((await post("/api/games", { groupName: "x", members: [{ name: "a" }] })).status, 400);
  assert.equal((await fetch(`${base}/api/games/../../etc`)).status, 404);
});

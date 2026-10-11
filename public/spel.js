const params = new URLSearchParams(location.search);
const id = params.get("id");
const app = document.getElementById("app");

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "onclick") node.addEventListener("click", v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== "") node.append(c);
  return node;
};
const euro = (cents) => `€${(cents / 100).toFixed(2).replace(".", ",")}`;

async function load() {
  if (!id) return (app.textContent = "Geen spel gevonden.");
  let data;
  const sessionId = params.get("session_id");
  if (sessionId) {
    const res = await fetch(`/api/games/${id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
    data = await res.json();
    history.replaceState(null, "", `/spel.html?id=${id}`);
  } else {
    const res = await fetch(`/api/games/${id}`);
    if (!res.ok) return (app.textContent = "Dit spel bestaat niet (meer).");
    data = await res.json();
  }
  render(data);
}

function renderQuestion(q, i) {
  return el(
    "div",
    { class: "qa" },
    el("b", {}, `${i + 1}. ${q.question}`),
    q.options.length ? el("ol", { type: "A" }, q.options.map((o) => el("li", {}, o))) : null,
    el("div", { class: "answer" }, `Antwoord: ${q.answer}`),
    q.hostNote ? el("div", { class: "note" }, q.hostNote) : null
  );
}

function render(data) {
  const { game, paid } = data;
  app.replaceChildren();
  app.append(el("div", { class: "game-head" }, el("span", { class: "pill" }, paid ? "Volledig spel" : "Gratis voorproefje"), el("h1", {}, game.title), el("p", {}, game.intro)));

  if (paid) {
    app.append(
      el(
        "div",
        { class: "toolbar" },
        el("button", { class: "btn", onclick: () => openHost(game) }, "▶ Start spelleider-modus"),
        el("button", { class: "btn ghost", onclick: () => print() }, "🖨 Print spelboekje"),
        el("button", { class: "btn ghost", onclick: () => share() }, "🔗 Deel met de spelleider")
      )
    );
  }

  game.rounds.forEach((round, r) => {
    if (round.locked) {
      app.append(el("div", { class: "round locked" }, el("div", { class: "tag" }, `Ronde ${r + 1}`), el("h2", {}, round.title), el("p", {}, round.explanation), el("p", {}, `🔒 ${round.count} vragen en opdrachten`)));
      return;
    }
    const box = el("div", { class: "round" }, el("div", { class: "tag" }, `Ronde ${r + 1}`), el("h2", {}, round.title), el("p", {}, round.explanation), round.questions.map(renderQuestion));
    app.append(box);
    if (!paid && r === 0) app.append(paywall(data));
  });

  if (paid) app.append(el("div", { class: "round" }, el("h2", {}, "Finale"), el("p", {}, game.finale)));
}

function paywall(data) {
  const btn = el("button", { class: "btn" }, `Ontgrendel het hele spel voor ${euro(data.price)}`);
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Even geduld…";
    const res = await fetch(`/api/games/${data.id}/checkout`, { method: "POST" });
    const json = await res.json();
    if (json.url) location.href = json.url;
    else {
      btn.disabled = false;
      btn.textContent = json.error || "Probeer het opnieuw";
    }
  });
  return el(
    "div",
    { class: "paywall" },
    el("h2", {}, `Nog ${data.game.lockedQuestions} vragen en opdrachten wachten op jullie`),
    el("p", {}, "Inclusief spelleider-modus voor tv of telefoon, printbaar spelboekje en de grote finale. Eenmalig betalen, geen abonnement."),
    btn,
    el("p", { class: "hint", style: "color:#dfe9e3" }, data.demoMode ? "Testmodus: er wordt niets afgeschreven." : "Veilig betalen met iDEAL, Bancontact of creditcard. Niet tevreden? Geld terug.")
  );
}

async function share() {
  const url = `${location.origin}/spel.html?id=${id}`;
  if (navigator.share) await navigator.share({ title: "Ons kerstspel", url }).catch(() => {});
  else {
    await navigator.clipboard.writeText(url);
    alert("Link gekopieerd!");
  }
}

// ---------- Spelleider-modus ----------
const host = document.getElementById("host");
const stage = document.getElementById("hostStage");
let slides = [];
let pos = 0;
let revealed = false;

function openHost(game) {
  slides = [{ type: "text", title: game.title, body: game.intro }];
  game.rounds.forEach((r, i) => {
    slides.push({ type: "text", title: `Ronde ${i + 1}: ${r.title}`, body: r.explanation });
    r.questions.forEach((q) => slides.push({ type: "q", q }));
  });
  slides.push({ type: "text", title: "Finale", body: game.finale });
  pos = 0;
  host.classList.add("on");
  showSlide();
}

function showSlide() {
  revealed = false;
  const s = slides[pos];
  document.getElementById("hostProgress").textContent = `${pos + 1} / ${slides.length}`;
  document.getElementById("hostReveal").style.visibility = s.type === "q" ? "visible" : "hidden";
  if (s.type === "text") stage.replaceChildren(el("h2", {}, s.title), el("p", {}, s.body));
  else
    stage.replaceChildren(
      el("h2", {}, s.q.question),
      el("div", { class: "opts" }, s.q.options.map((o) => el("div", { "data-opt": o }, o))),
      el("p", { class: "reveal", hidden: "" }, `Antwoord: ${s.q.answer}`),
      s.q.hostNote ? el("p", { class: "reveal", hidden: "", style: "opacity:.8;font-style:italic" }, s.q.hostNote) : null
    );
}

function reveal() {
  const s = slides[pos];
  if (s.type !== "q" || revealed) return;
  revealed = true;
  stage.querySelectorAll(".reveal").forEach((n) => n.removeAttribute("hidden"));
  stage.querySelectorAll("[data-opt]").forEach((n) => n.dataset.opt === s.q.answer && n.classList.add("ok"));
}

const go = (d) => {
  pos = Math.max(0, Math.min(slides.length - 1, pos + d));
  showSlide();
};
document.getElementById("hostNext").onclick = () => go(1);
document.getElementById("hostPrev").onclick = () => go(-1);
document.getElementById("hostReveal").onclick = reveal;
document.getElementById("hostClose").onclick = () => host.classList.remove("on");
document.addEventListener("keydown", (e) => {
  if (!host.classList.contains("on")) return;
  if (e.key === "ArrowRight") go(1);
  if (e.key === "ArrowLeft") go(-1);
  if (e.key === " ") (e.preventDefault(), reveal());
  if (e.key === "Escape") host.classList.remove("on");
});

load();

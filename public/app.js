const membersEl = document.getElementById("members");
const tpl = document.getElementById("memberTpl");

function addMember(name = "", facts = "") {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector("[name=name]").value = name;
  node.querySelector("[name=facts]").value = facts;
  node.querySelector(".remove").addEventListener("click", () => node.remove());
  membersEl.appendChild(node);
}

for (let i = 0; i < 4; i++) addMember();
document.getElementById("addMember").addEventListener("click", () => addMember());

document.getElementById("wizard").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const error = document.getElementById("formError");
  const btn = document.getElementById("submitBtn");
  error.textContent = "";

  const members = [...membersEl.querySelectorAll(".member")]
    .map((m) => ({ name: m.querySelector("[name=name]").value.trim(), facts: m.querySelector("[name=facts]").value.trim() }))
    .filter((m) => m.name);
  if (members.length < 2) {
    error.textContent = "Vul minstens 2 namen in.";
    return;
  }

  const data = new FormData(form);
  const body = {
    plan: data.get("plan"),
    groupName: data.get("groupName"),
    occasion: data.get("occasion"),
    ages: data.get("ages"),
    tone: data.get("tone"),
    members,
    yearHighlights: data.get("yearHighlights"),
    traditions: data.get("traditions"),
  };

  btn.disabled = true;
  btn.textContent = "Jullie spel wordt gemaakt… (± 30 sec)";
  try {
    const res = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Er ging iets mis.");
    location.href = `/spel?id=${json.id}`;
  } catch (err) {
    error.textContent = err.message;
    btn.disabled = false;
    btn.textContent = "Maak ons spel (gratis voorproefje)";
  }
});

// Kør: npm test  — holder "Guide mig" i takt med appen: hvert trin skal pege
// på et `data-guide`-felt, der stadig findes i koden, og guidens side skal være
// en tilladt chatbot-genvej.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HELP_GUIDES } from "./help-guides.ts";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const addActions = read("./add-actions.ts");
const navigation = read("./navigation.ts");
const addButton = read("../components/AddButton.tsx");
const bottomNav = read("../components/BottomNav.tsx");
const chatbotKnowledge = read("./chatbot-knowledge.ts");

test("guide ids are unique and every guide has steps", () => {
  const ids = HELP_GUIDES.map((guide) => guide.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const guide of HELP_GUIDES) assert.ok(guide.steps.length > 0, guide.id);
});

test("every guide ends on an allowed chatbot link", () => {
  for (const guide of HELP_GUIDES) {
    assert.ok(chatbotKnowledge.includes(`"${guide.href}":`), `${guide.id}: ${guide.href} mangler i CHATBOT_LINKS`);
  }
});

test("every step target still exists in the UI code", () => {
  assert.ok(addButton.includes('data-guide="add-fab"'), "plus-knappen mangler data-guide");
  assert.ok(addButton.includes("data-guide={`add-${action.key}`}"), "hjulets handlinger mangler data-guide");
  assert.ok(bottomNav.includes("data-guide={`nav-${key}`}"), "bundmenuen mangler data-guide");
  for (const guide of HELP_GUIDES) {
    for (const step of guide.steps) {
      assert.ok(step.da && step.en, `${guide.id}: trin uden tekst`);
      if (step.target === "add-fab") continue;
      if (step.target.startsWith("add-")) {
        assert.ok(addActions.includes(`key: "${step.target.slice(4)}"`), `${guide.id}: ${step.target} findes ikke i add-actions.ts`);
      } else if (step.target.startsWith("nav-")) {
        assert.ok(new RegExp(`\\b${step.target.slice(4)}:`).test(navigation), `${guide.id}: ${step.target} findes ikke i navigation.ts`);
      } else {
        assert.fail(`${guide.id}: ukendt target ${step.target}`);
      }
    }
  }
});

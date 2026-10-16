// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFindings, cleanDoubtAnswers, doubtText } from "./back-photo-spelling.ts";
import { createDictionary } from "./spelling-engine.ts";

const dictionary = createDictionary({ knownWords: ["hvedemel", "rapsolie", "salt"] });
const finding = (word, suggestion, similarity = 0.85) => ({ word, suggestion, start: 0, end: word.length, similarity });

test("ordbogen afgør: kendt gemt ord røres ikke, kendt læst ord er sikkert, resten er tvivl", () => {
  const { sure, doubtful } = classifyFindings(
    [finding("hvedemel", "hvedemol"), finding("hvedcmel", "hvedemel"), finding("quinoaflager", "quinoaflagor")],
    dictionary,
  );
  assert.deepEqual(sure.map((f) => f.suggestion), ["hvedemel"]);
  assert.deepEqual(doubtful.map((f) => f.word), ["quinoaflager"]);
});

test("for forskellige ord er aldrig en sikker rettelse", () => {
  const { sure, doubtful } = classifyFindings([finding("xyzsalt", "salt", 0.5)], dictionary);
  assert.equal(sure.length, 0);
  assert.equal(doubtful.length, 1);
});

test("AI-svaret ryddes: ugyldige index og tomme rettelser", () => {
  const answers = cleanDoubtAnswers({ words: [{ index: 0, correct: "quinoaflager", confidence: 1.4, reason: "ok" }, { index: 5, correct: "x", confidence: 1, reason: "" }, { index: 1, correct: "  ", confidence: 0.5, reason: "" }] }, 2);
  assert.deepEqual(answers.map((a) => [a.index, a.correct, a.confidence]), [[0, "quinoaflager", 1], [1, null, 0.5]]);
  assert.match(doubtText("liste", [finding("a", "b")]), /0: "a" → "b"/);
});

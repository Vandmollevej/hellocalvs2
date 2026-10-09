// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { averageAnswer, cleanAnswers, cleanQuestions, formatScreeningValue, scaleRange } from "./screenings.ts";

test("skalaer", () => {
  assert.deepEqual(scaleRange("FIVE"), { min: 1, max: 5, step: 1 });
  assert.deepEqual(scaleRange("TEN"), { min: 1, max: 10, step: 1 });
  assert.deepEqual(scaleRange("PERCENT"), { min: 0, max: 100, step: 5 });
  assert.equal(formatScreeningValue(7, "TEN"), "7");
  assert.equal(formatScreeningValue(42.5, "PERCENT"), "42.5 %");
});

test("spørgsmål renses: tomme fjernes, id'er er unikke", () => {
  const questions = cleanQuestions([
    { id: "a", text: " Hovedpine? " },
    { id: "a", text: "Kvalme?" },
    { id: "b", text: "   " },
    "x",
  ]);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].text, "Hovedpine?");
  assert.notEqual(questions[0].id, questions[1].id);
  assert.deepEqual(cleanQuestions("nope"), []);
});

test("svar holdes inden for skalaen og ukendte spørgsmål ignoreres", () => {
  const questions = [{ id: "a", text: "A" }, { id: "b", text: "B" }];
  assert.deepEqual(cleanAnswers({ a: 99, b: 0, c: 5 }, questions, "TEN"), { a: 10, b: 1 });
  assert.deepEqual(cleanAnswers({ a: "x" }, questions, "FIVE"), {});
  assert.equal(averageAnswer({ a: 3, b: 4 }), 3.5);
  assert.equal(averageAnswer({}), 0);
});

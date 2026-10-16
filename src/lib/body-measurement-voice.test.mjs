// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  firstGuideIndex,
  formatSpokenValue,
  guideStep,
  interpretMeasurementSpeech,
  parseSpokenNumber,
  startGuide,
} from "./body-measurement-voice.ts";

test("tal med cifre, komma og enhed", () => {
  assert.equal(parseSpokenNumber("82,5"), 82.5);
  assert.equal(parseSpokenNumber("82.5 cm"), 82.5);
  assert.equal(parseSpokenNumber("Det er 37 centimeter."), 37);
  assert.equal(parseSpokenNumber("82 komma 5"), 82.5);
  assert.equal(parseSpokenNumber("37 og en halv"), 37.5);
  assert.equal(parseSpokenNumber("31 inches"), 31);
});

test("danske og engelske talord", () => {
  assert.equal(parseSpokenNumber("toogfirs"), 82);
  assert.equal(parseSpokenNumber("to og firs komma fem"), 82.5);
  assert.equal(parseSpokenNumber("halvfems"), 90);
  assert.equal(parseSpokenNumber("et hundrede og tolv"), 112);
  assert.equal(parseSpokenNumber("syvogtredive og en halv"), 37.5);
  assert.equal(parseSpokenNumber("thirty seven point five"), 37.5);
  assert.equal(parseSpokenNumber("spring over"), null);
});

test("kommandoer — og intet andet", () => {
  assert.deepEqual(interpretMeasurementSpeech("spring over"), { kind: "skip" });
  assert.deepEqual(interpretMeasurementSpeech("Næste"), { kind: "skip" });
  assert.deepEqual(interpretMeasurementSpeech("tilbage"), { kind: "back" });
  assert.deepEqual(interpretMeasurementSpeech("gentag"), { kind: "repeat" });
  assert.deepEqual(interpretMeasurementSpeech("stop"), { kind: "stop" });
  assert.deepEqual(interpretMeasurementSpeech("hvad er klokken"), { kind: "repeat" });
  assert.deepEqual(interpretMeasurementSpeech("bestil en pizza"), { kind: "unknown" });
  assert.deepEqual(interpretMeasurementSpeech("næsten"), { kind: "unknown" });
  assert.deepEqual(interpretMeasurementSpeech(""), { kind: "unknown" });
  assert.deepEqual(interpretMeasurementSpeech("82,46"), { kind: "value", value: 82.5 });
});

const FIELDS = ["chestCm", "waistCm", "calfCm"];

test("guiden spørger, gemmer, siger tallet tilbage og går videre", () => {
  const start = startGuide(FIELDS, 0);
  assert.deepEqual(start.say.map((line) => line.key), ["intro", "ask", "how.chestCm"]);

  const second = guideStep(start.state, "95", "cm");
  assert.deepEqual(second.save, { field: "chestCm", value: 95 });
  assert.deepEqual(second.say, [
    { key: "recorded", value: 95 },
    { key: "next", field: "waistCm" },
    { key: "how.waistCm" },
  ]);
  assert.equal(second.done, false);

  const skipped = guideStep(second.state, "spring over", "cm");
  assert.equal(skipped.save, undefined);
  assert.equal(skipped.state.index, 2);

  const last = guideStep(skipped.state, "38", "cm");
  assert.deepEqual(last.save, { field: "calfCm", value: 38 });
  assert.deepEqual(last.say.map((line) => line.key), ["recorded", "done"]);
  assert.equal(last.done, true);
});

test("urimelige tal gemmes ikke, og guiden spørger igen", () => {
  const start = startGuide(FIELDS, 0);
  const step = guideStep(start.state, "3", "cm");
  assert.equal(step.save, undefined);
  assert.equal(step.state.index, 0);
  assert.equal(step.say[0].key, "outOfRange");
  // 3 tommer er heller ikke et kropsmål, men 40 tommer er.
  assert.equal(guideStep(start.state, "40", "in").save?.value, 40);
  assert.equal(guideStep(start.state, "400", "cm").save, undefined);
});

test("tilbage, gentag og stop", () => {
  const start = startGuide(FIELDS, 1);
  assert.equal(guideStep(start.state, "tilbage", "cm").state.index, 0);
  assert.equal(guideStep({ ...start.state, index: 0 }, "tilbage", "cm").state.index, 0);
  assert.deepEqual(guideStep(start.state, "gentag", "cm").say.map((line) => line.key), ["ask", "how.waistCm"]);
  const stopped = guideStep(start.state, "stop", "cm");
  assert.equal(stopped.done, true);
  assert.equal(stopped.save, undefined);
});

test("stopper efter tre forsøg uden noget brugbart", () => {
  let step = startGuide(FIELDS, 0);
  step = guideStep(step.state, null, "cm");
  assert.equal(step.say[0].key, "notHeard");
  step = guideStep(step.state, "øhm", "cm");
  assert.equal(step.say[0].key, "notUnderstood");
  assert.equal(step.done, false);
  step = guideStep(step.state, null, "cm");
  assert.equal(step.done, true);
  assert.equal(step.say[0].key, "giveUp");
});

test("starter ved første mål uden dagens tal", () => {
  assert.equal(firstGuideIndex(FIELDS, (field) => field === "chestCm"), 1);
  assert.equal(firstGuideIndex(FIELDS, () => true), 0);
  assert.equal(startGuide([], 0).done, true);
});

test("tallet siges med sprogets decimaltegn", () => {
  assert.equal(formatSpokenValue(82.5, "da"), "82,5");
  assert.equal(formatSpokenValue(82.5, "en"), "82.5");
  assert.equal(formatSpokenValue(82, "da"), "82");
});

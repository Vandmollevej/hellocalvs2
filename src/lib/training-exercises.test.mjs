// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { TRAINING_EXERCISES, parseTrainingEntries, searchTrainingExercises, trainingImage } from "./training-exercises.ts";

test("alle øvelser har billede og unik nøgle", () => {
  const keys = new Set();
  for (const exercise of TRAINING_EXERCISES) {
    assert.ok(!keys.has(exercise.key), exercise.key);
    keys.add(exercise.key);
    assert.ok(existsSync(`public${trainingImage(exercise.key)}`), exercise.key);
  }
});

test("søgning virker på dansk og engelsk", () => {
  assert.ok(searchTrainingExercises("free_weights", "dødløft").some((e) => e.key === "barbell_deadlift"));
  assert.ok(searchTrainingExercises("free_weights", "deadlift").some((e) => e.key === "barbell_deadlift"));
  assert.ok(searchTrainingExercises("machines", "benpres").some((e) => e.key === "leg_press"));
  assert.ok(searchTrainingExercises("machines", "leg press").some((e) => e.key === "leg_press"));
  assert.ok(searchTrainingExercises("crossfit", "armstrækninger").some((e) => e.key === "pushups"));
  assert.ok(searchTrainingExercises("crossfit", "push-ups").some((e) => e.key === "pushups"));
  assert.equal(searchTrainingExercises("crossfit", "benpres").length, 0);
});

test("ugyldige øvelser og sæt smides væk", () => {
  assert.equal(parseTrainingEntries(null), null);
  assert.equal(parseTrainingEntries([{ key: "findes_ikke", sets: [{ weightKg: 10, reps: 5 }] }]), null);
  assert.deepEqual(
    parseTrainingEntries([{ key: "leg_press", sets: [{ weightKg: 100.3, reps: 10 }, { weightKg: -1, reps: 5 }, { weightKg: 20, reps: 0 }] }]),
    [{ key: "leg_press", sets: [{ weightKg: 100.5, reps: 10 }] }],
  );
});

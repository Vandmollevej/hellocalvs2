// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { peopleSharedWith } from "./family-sharing.ts";

const family = {
  ownerId: "far",
  ownerName: "Peter",
  members: [
    { userId: "far", displayName: "Peter" },
    { userId: "mor", displayName: "Anne" },
    { userId: "barn", displayName: "Ida" },
    { userId: "bror", displayName: "Ole" },
  ],
  grants: [
    { granteeId: "mor", subjectId: "barn" },
    { granteeId: "barn", subjectId: "mor" },
  ],
};

test("betaleren står altid først, derefter dem med en tildeling", () => {
  assert.deepEqual(peopleSharedWith(family, "barn"), [
    { userId: "far", displayName: "Peter", isOwner: true },
    { userId: "mor", displayName: "Anne", isOwner: false },
  ]);
});

test("uden tildelinger deles kun med betaleren", () => {
  assert.deepEqual(
    peopleSharedWith(family, "bror").map((person) => person.displayName),
    ["Peter"]
  );
});

test("betaleren deler ikke med sig selv", () => {
  assert.deepEqual(peopleSharedWith(family, "far"), []);
});

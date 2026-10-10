// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { peopleSharedWith, sharingDeciderId } from "./family-sharing.ts";

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
    { granteeId: "mor", subjectId: "barn", canWrite: true },
    { granteeId: "barn", subjectId: "mor", canWrite: false },
  ],
};

test("betaleren står altid først, derefter dem med en tildeling", () => {
  assert.deepEqual(peopleSharedWith(family, "barn"), [
    { userId: "far", displayName: "Peter", isOwner: true, canWrite: true },
    { userId: "mor", displayName: "Anne", isOwner: false, canWrite: true },
  ]);
});

test("en tildeling uden canWrite giver kun læseadgang", () => {
  assert.deepEqual(peopleSharedWith(family, "mor")[1], { userId: "barn", displayName: "Ida", isOwner: false, canWrite: false });
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

test("voksne med eget login bestemmer selv over deres deling", () => {
  assert.equal(sharingDeciderId({ userId: "mor", hasLogin: true, isChild: false, age: 43 }, "far"), "mor");
});

test("betaleren bestemmer for profiler uden login og børn under 15", () => {
  assert.equal(sharingDeciderId({ userId: "baby", hasLogin: false, isChild: true, age: 3 }, "far"), "far");
  assert.equal(sharingDeciderId({ userId: "ida", hasLogin: true, isChild: true, age: 12 }, "far"), "far");
  assert.equal(sharingDeciderId({ userId: "ida", hasLogin: true, isChild: true, age: null }, "far"), "far");
  assert.equal(sharingDeciderId({ userId: "teen", hasLogin: true, isChild: true, age: 15 }, "far"), "teen");
  assert.equal(sharingDeciderId({ userId: "far", hasLogin: true, isChild: false, age: 45 }, "far"), "far");
});

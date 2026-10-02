// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAmountGrams, packageVolumeMl } from "./default-amount.ts";

const drink = (fields) => ({ productCategory: "DRINK", ...fields });

test("dåser og små flasker starter på hele pakken", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Coca-Cola", packageSizeText: "33 cl" })), 330);
  assert.equal(defaultAmountGrams(drink({ name: "Faxe Kondi", packageSizeText: "25cl" })), 250);
  assert.equal(defaultAmountGrams(drink({ name: "Tuborg Grøn", packageSizeText: "50 cl" })), 500);
  assert.equal(defaultAmountGrams(drink({ name: "Carlsberg", packageSizeText: "6 x 33 cl" })), 330);
});

test("størrelsen i navnet bruges, når pakningsstørrelsen mangler", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Tuborg Classic 33 cl" })), 330);
  assert.equal(defaultAmountGrams(drink({ name: "Pepsi Max 50cl" })), 500);
});

test("øl uden kategorien DRINK genkendes på navn + størrelse", () => {
  assert.equal(defaultAmountGrams({ name: "Carlsberg Pilsner 33 cl" }), 330);
  assert.equal(defaultAmountGrams({ productCategory: "PROCESSED", name: "Royal Classic", productType: "Øl", packageSizeText: "50 cl" }), 500);
});

test("vin: lille flaske er hele flasken, ellers et glas", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Rødvin", packageSizeText: "75 cl" })), 150);
  assert.equal(defaultAmountGrams(drink({ name: "Prosecco piccolo", packageSizeText: "20 cl" })), 200);
  assert.equal(defaultAmountGrams(drink({ name: "Hvidvin", packageSizeText: "25 cl" })), 250);
});

test("spiritus: miniature er hele flasken, ellers 4 cl", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Gammel Dansk", productType: "Bitter", packageSizeText: "70cl" })), 40);
  assert.equal(defaultAmountGrams(drink({ name: "Jägermeister", packageSizeText: "2 cl", dietaryTags: { pct: "35 %" } })), 20);
  assert.equal(defaultAmountGrams(drink({ name: "Vodka", packageSizeText: "35cl" })), 40);
});

test("færdigblandede drinks er hele dåsen", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Gin & Tonic", packageSizeText: "25 cl", dietaryTags: { pct: "5 %" } })), 250);
  assert.equal(defaultAmountGrams(drink({ name: "Rom og Cola", packageSizeText: "33 cl" })), 330);
});

test("store flasker giver et glas", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Sodavand", packageSizeText: "1,5 l" })), 250);
  assert.equal(defaultAmountGrams(drink({ name: "Appelsinjuice", packageSizeText: "1 l" })), 250);
});

test("fløde og olie tages ikke som hel pakke", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Piskefløde 38%", packageSizeText: "25 cl" })), 30);
  assert.equal(defaultAmountGrams(drink({ name: "Olivenolie", packageSizeText: "50 cl" })), 10);
});

test("brugerens seneste mængde vinder stadig", () => {
  assert.equal(defaultAmountGrams(drink({ name: "Cola", packageSizeText: "33 cl", lastAmountGrams: 500 })), 500);
});

test("flere varer får en typisk mængde frem for 100 g", () => {
  assert.equal(defaultAmountGrams({ name: "Hakket oksekød 8-12%" }), 150);
  assert.equal(defaultAmountGrams({ name: "Laksefilet" }), 125);
  assert.equal(defaultAmountGrams({ name: "Banan" }), 120);
  assert.equal(defaultAmountGrams({ name: "Tomatsuppe" }), 300);
  assert.equal(defaultAmountGrams({ name: "Pizza Margherita" }), 350);
});

test("packageVolumeMl", () => {
  assert.equal(packageVolumeMl("33 cl"), 330);
  assert.equal(packageVolumeMl("1,5 l"), 1500);
  assert.equal(packageVolumeMl("5 dl"), 500);
  assert.equal(packageVolumeMl("500 g"), null);
});

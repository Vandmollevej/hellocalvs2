// "Viden om mad" → Allergener (bruger 2026-10-17): én side pr. EU-allergen
// (forordning 1169/2011, bilag II). Slug = nøglen i src/lib/allergens.ts, så
// ingredienslistens allergen-ord kan linke direkte hertil (allergenHref).
// Native får teksterne via scripts/native/sync.mjs (OnbKnowledgeData.kt).

import type { KnowledgeArticle } from "@/lib/knowledge";

const EU_SOURCE = {
  label: "EU-forordning 1169/2011 om fødevareinformation, bilag II",
  href: "https://eur-lex.europa.eu/legal-content/DA/TXT/?uri=CELEX:32011R1169",
};
const MORE_SOURCES = [
  {
    label: "sundhed.dk: Mærkning af fødevarer (fødevareallergi og -intolerans)",
    href: "https://www.sundhed.dk/borger/patienthaandbogen/allergi/sygdomme/foedevareallergi-og-intolerance-kostraad/maerkning-af-foedevarer/",
  },
  {
    label: "Your Europe: Regler om fødevaremærkning",
    href: "https://europa.eu/youreurope/business/product-rules-compliance/food/labelling-rules/index_da.htm",
  },
];

const LABEL_RULE =
  "I EU skal allergenet fremhæves i ingredienslisten, fx med fed skrift eller STORE bogstaver. Hello Cal viser derfor altid allergener med STORT og fed, og et klik på ordet fører hertil.";

function allergen(
  slug: string,
  title: string,
  summary: string,
  words: string,
  hidden: string,
  extra?: string,
): KnowledgeArticle {
  return {
    slug,
    category: "allergener",
    title,
    summary,
    body: [`Typiske ord i ingredienslisten: ${words}.`, `Kan gemme sig i: ${hidden}.`, ...(extra ? [extra] : []), LABEL_RULE],
    source: EU_SOURCE,
    moreSources: MORE_SOURCES,
  };
}

export const ALLERGEN_ARTICLES: KnowledgeArticle[] = [
  allergen(
    "gluten",
    "Gluten (kornsorter med gluten)",
    "Hvede (herunder spelt og khorasanhvede), rug, byg, havre og hybrider af dem samt produkter heraf.",
    "hvede, hvedemel, spelt, kamut, durum, semulje, rug, rugmel, byg, bygmalt, havre, havregryn, gluten",
    "brød, pasta, kiks, paneringer, saucer, supper, bouillon, krydderiblandinger, øl og maltekstrakt",
    "Undtaget er bl.a. glukosesirup og dextrose fremstillet af hvede eller byg samt maltodextrin af hvede, fordi forarbejdningen fjerner allergenet.",
  ),
  allergen(
    "crustaceans",
    "Skaldyr (krebsdyr)",
    "Krebsdyr og produkter heraf, fx rejer, krabber, hummer, jomfruhummer og krebs.",
    "rejer, krabbe, hummer, jomfruhummer, krebs, skaldyr, krebsdyr",
    "fiskefrikadeller, fiskesupper, asiatiske saucer og pastaer, salater og færdigretter",
  ),
  allergen(
    "eggs",
    "Æg",
    "Æg og produkter heraf — fra høns og andre fugle.",
    "æg, æggeblomme, æggehvide, ægpulver, helæg, pasteuriseret æg, albumin, lysozym",
    "mayonnaise, remoulade, dressinger, kager, pasta, paneringer, frikadeller og is",
  ),
  allergen(
    "fish",
    "Fisk",
    "Fisk og produkter heraf.",
    "fisk, torsk, laks, tun, sild, makrel, ansjos, fiskesauce, fiskegelatine",
    "fiskesauce, Worcestershire sauce, Cæsar-dressing, pizza, salater og bouillon",
    "Undtaget er fiskegelatine brugt som bærestof for vitaminer og fiskegelatine eller husblas brugt til klaring af øl og vin.",
  ),
  allergen(
    "peanuts",
    "Jordnødder",
    "Jordnødder og produkter heraf.",
    "jordnødder, peanuts, jordnøddeolie, jordnøddesmør, arachis",
    "slik, chokolade, kiks, müsli, asiatiske retter, saucer og satay",
  ),
  allergen(
    "soybeans",
    "Soja",
    "Sojabønner og produkter heraf.",
    "soja, sojabønner, sojaprotein, sojalecithin, sojasauce, sojaolie, tofu, tempeh, edamame",
    "kødprodukter, vegetarretter, chokolade, brød, saucer og supper",
    "Undtaget er bl.a. fuldt raffineret sojaolie og visse tocopheroler og fytosteroler fremstillet af soja.",
  ),
  allergen(
    "milk",
    "Mælk (herunder laktose)",
    "Mælk og produkter heraf, herunder laktose.",
    "mælk, skummetmælkspulver, fløde, smør, ost, valle, vallepulver, laktose, kasein, kaseinat, yoghurt, skyr",
    "brød, pølser, chips, krydderiblandinger, chokolade, saucer, supper og færdigretter",
    "Undtaget er valle brugt til alkoholiske destillater og laktitol.",
  ),
  allergen(
    "nuts",
    "Nødder",
    "Mandler, hasselnødder, valnødder, cashewnødder, pekannødder, paranødder, pistacienødder og macadamianødder samt produkter heraf.",
    "mandler, hasselnødder, valnødder, cashewnødder, pekannødder, paranødder, pistacienødder, macadamianødder, marcipan, nougat",
    "chokolade, kager, kiks, müsli, pesto, is og dressinger",
  ),
  allergen(
    "celery",
    "Selleri",
    "Selleri og produkter heraf — både knoldselleri, bladselleri og sellerifrø.",
    "selleri, knoldselleri, bladselleri, sellerisalt, sellerifrø",
    "bouillon, supper, saucer, krydderiblandinger, pølser og færdigretter",
  ),
  allergen(
    "mustard",
    "Sennep",
    "Sennep og produkter heraf.",
    "sennep, sennepsfrø, sennepspulver, sennepsolie",
    "dressinger, remoulade, mayonnaise, marinader, pølser, karry og krydderiblandinger",
  ),
  allergen(
    "sesame-seeds",
    "Sesamfrø",
    "Sesamfrø og produkter heraf.",
    "sesam, sesamfrø, sesamolie, tahin, tahini",
    "brød, knækbrød, hummus, asiatiske retter, salatdressinger og müslibarer",
  ),
  allergen(
    "sulphur-dioxide-and-sulphites",
    "Svovldioxid og sulfitter",
    "Svovldioxid og sulfitter i koncentrationer over 10 mg/kg eller 10 mg/liter (som SO₂).",
    "svovldioxid, sulfit, natriumsulfit, natriumbisulfit, natriummetabisulfit, kaliummetabisulfit, E220–E228",
    "vin, øl, tørret frugt, syltede grøntsager, kartoffelprodukter, sennep og eddike",
  ),
  allergen(
    "lupin",
    "Lupin",
    "Lupin og produkter heraf.",
    "lupin, lupinmel, lupinprotein",
    "glutenfrit brød og bagværk, pasta og vegetariske produkter",
  ),
  allergen(
    "molluscs",
    "Bløddyr",
    "Bløddyr og produkter heraf, fx muslinger, østers, blæksprutter og snegle.",
    "muslinger, blåmuslinger, østers, kammuslinger, blæksprutte, calamari, snegle, bløddyr",
    "østerssauce, fiskesupper, paella, asiatiske saucer og færdigretter",
  ),
];

// Fælles baggrundsinfo om vitaminer og mineraler til /vitaminer-siden og
// info-popuppen på varesiden — samme mønster som E-numre (/e-numre#e330).
// Nøglerne er NutrientKey fra src/lib/nutrients.ts, så en række i "Vis mere"-
// tabellen kan linke direkte til sit afsnit (/vitaminer#vitaminc).
//
// "Referenceindtag" er EU's referenceindtag for voksne (NRV, forordning
// 1169/2011 bilag XIII) — samme tal som "% RI" på varedeklarationer.
import type { NutrientKey } from "@/lib/nutrients";

export type MicronutrientInfo = {
  key: NutrientKey;
  group: "vitamin" | "mineral";
  name: string;
  alsoKnownAs: string;
  function: string;
  sources: string;
  referenceIntake: string;
  tooLittleOrMuch: string;
  searchTerm: string;
};

export const MICRONUTRIENT_INFO: MicronutrientInfo[] = [
  {
    key: "vitaminA",
    group: "vitamin",
    name: "Vitamin A",
    alsoKnownAs: "Retinol, betacaroten (forstadie)",
    function: "Bidrager til normalt syn, normal hud og slimhinder og et normalt immunforsvar.",
    sources: "Lever, æg, mælkeprodukter, smør; betacaroten i gulerødder, spinat og grønkål.",
    referenceIntake: "800 µg pr. dag",
    tooLittleOrMuch:
      "Mangel er sjælden i Danmark. Store mængder retinol (fx meget lever eller kosttilskud) kan være skadeligt, især under graviditet.",
    searchTerm: "vitamin A",
  },
  {
    key: "vitaminC",
    group: "vitamin",
    name: "Vitamin C",
    alsoKnownAs: "Ascorbinsyre",
    function:
      "Bidrager til normalt immunforsvar, dannelse af kollagen og øger optagelsen af jern fra kosten.",
    sources: "Peberfrugt, citrusfrugter, kiwi, bær, kål og kartofler.",
    referenceIntake: "80 mg pr. dag",
    tooLittleOrMuch:
      "Vandopløseligt — overskud udskilles. Meget store doser fra tilskud kan give maveproblemer.",
    searchTerm: "vitamin C",
  },
  {
    key: "vitaminD",
    group: "vitamin",
    name: "Vitamin D",
    alsoKnownAs: "Kolecalciferol (D3), ergocalciferol (D2)",
    function: "Bidrager til optagelse af calcium og til normale knogler, tænder og muskler.",
    sources: "Fed fisk, æg og berigede produkter; dannes også i huden i sollys.",
    referenceIntake: "5 µg pr. dag",
    tooLittleOrMuch:
      "Mange danskere får for lidt i vinterhalvåret, og Sundhedsstyrelsen anbefaler tilskud til flere grupper. Meget store tilskud over længere tid kan være skadeligt.",
    searchTerm: "vitamin D",
  },
  {
    key: "vitaminE",
    group: "vitamin",
    name: "Vitamin E",
    alsoKnownAs: "Tocopherol",
    function: "Bidrager til at beskytte cellerne mod oxidativt stress.",
    sources: "Planteolier, nødder, frø, fuldkorn og grønne grøntsager.",
    referenceIntake: "12 mg pr. dag",
    tooLittleOrMuch: "Mangel er sjælden. Høje doser fra tilskud kan påvirke blodets størkning.",
    searchTerm: "vitamin E",
  },
  {
    key: "vitaminK",
    group: "vitamin",
    name: "Vitamin K",
    alsoKnownAs: "Fyllokinon (K1), menakinoner (K2)",
    function: "Bidrager til normal blodstørkning og til normale knogler.",
    sources: "Grønne bladgrøntsager, kål, broccoli og planteolier.",
    referenceIntake: "75 µg pr. dag",
    tooLittleOrMuch:
      "Mangel er sjælden hos voksne. Personer i blodfortyndende behandling (fx warfarin) bør holde et stabilt indtag.",
    searchTerm: "vitamin K",
  },
  {
    key: "vitaminB1",
    group: "vitamin",
    name: "Vitamin B1",
    alsoKnownAs: "Thiamin",
    function: "Bidrager til normal energiomsætning og normal funktion af nervesystemet og hjertet.",
    sources: "Fuldkorn, svinekød, bælgfrugter, nødder og kartofler.",
    referenceIntake: "1,1 mg pr. dag",
    tooLittleOrMuch: "Mangel ses især ved stort alkoholforbrug. Overskud udskilles med urinen.",
    searchTerm: "thiamine",
  },
  {
    key: "vitaminB2",
    group: "vitamin",
    name: "Vitamin B2",
    alsoKnownAs: "Riboflavin",
    function: "Bidrager til normal energiomsætning, normalt syn og normal hud og slimhinder.",
    sources: "Mælkeprodukter, æg, kød, lever og fuldkorn.",
    referenceIntake: "1,4 mg pr. dag",
    tooLittleOrMuch: "Mangel er sjælden. Overskud udskilles og farver urinen gul.",
    searchTerm: "riboflavin",
  },
  {
    key: "vitaminB3",
    group: "vitamin",
    name: "Vitamin B3",
    alsoKnownAs: "Niacin, nikotinamid",
    function: "Bidrager til normal energiomsætning, normalt nervesystem og normal hud.",
    sources: "Kød, fisk, fjerkræ, fuldkorn, nødder og bælgfrugter.",
    referenceIntake: "16 mg pr. dag",
    tooLittleOrMuch:
      "Mangel er sjælden. Høje doser nikotinsyre fra tilskud kan give rødme og påvirke leveren.",
    searchTerm: "niacin",
  },
  {
    key: "vitaminB5",
    group: "vitamin",
    name: "Vitamin B5",
    alsoKnownAs: "Pantotensyre",
    function: "Bidrager til normal energiomsætning og til dannelse af visse hormoner.",
    sources: "Findes i de fleste fødevarer — fx kød, æg, fuldkorn, svampe og avocado.",
    referenceIntake: "6 mg pr. dag",
    tooLittleOrMuch: "Mangel er meget sjælden, og der kendes ingen skadelig øvre grænse fra kosten.",
    searchTerm: "pantothenic acid",
  },
  {
    key: "vitaminB6",
    group: "vitamin",
    name: "Vitamin B6",
    alsoKnownAs: "Pyridoxin",
    function: "Bidrager til normal proteinomsætning, dannelse af røde blodlegemer og normalt immunforsvar.",
    sources: "Kød, fisk, fjerkræ, kartofler, bananer og fuldkorn.",
    referenceIntake: "1,4 mg pr. dag",
    tooLittleOrMuch:
      "Mangel er sjælden. Store tilskud over længere tid kan give nervegener (føleforstyrrelser).",
    searchTerm: "vitamin B6",
  },
  {
    key: "vitaminB7",
    group: "vitamin",
    name: "Vitamin B7",
    alsoKnownAs: "Biotin",
    function: "Bidrager til normal energiomsætning og normalt hår og hud.",
    sources: "Æg, lever, nødder, frø og bælgfrugter.",
    referenceIntake: "50 µg pr. dag",
    tooLittleOrMuch:
      "Mangel er sjælden. Store tilskud kan forstyrre visse blodprøver — fortæl det til lægen.",
    searchTerm: "biotin",
  },
  {
    key: "vitaminB9",
    group: "vitamin",
    name: "Folat",
    alsoKnownAs: "Vitamin B9, folsyre",
    function:
      "Bidrager til celledeling og dannelse af blod; vigtigt for fosterets udvikling i starten af graviditeten.",
    sources: "Grønne bladgrøntsager, bælgfrugter, kål, fuldkorn og lever.",
    referenceIntake: "200 µg pr. dag",
    tooLittleOrMuch:
      "Kvinder, der planlægger graviditet, anbefales tilskud af folsyre. Meget folsyre kan skjule mangel på B12.",
    searchTerm: "folate",
  },
  {
    key: "vitaminB12",
    group: "vitamin",
    name: "Vitamin B12",
    alsoKnownAs: "Kobalamin",
    function: "Bidrager til dannelse af røde blodlegemer og normal funktion af nervesystemet.",
    sources: "Findes næsten kun i animalske fødevarer: kød, fisk, æg og mælkeprodukter.",
    referenceIntake: "2,5 µg pr. dag",
    tooLittleOrMuch:
      "Veganere og mange ældre har risiko for mangel og bør overveje tilskud. Overskud er ikke kendt for at være skadeligt.",
    searchTerm: "vitamin B12",
  },
  {
    key: "calcium",
    group: "mineral",
    name: "Calcium",
    alsoKnownAs: "Kalk",
    function: "Nødvendigt for normale knogler og tænder, muskelfunktion og blodstørkning.",
    sources: "Mælk, ost, yoghurt, grønne grøntsager, mandler og berigede plantedrikke.",
    referenceIntake: "800 mg pr. dag",
    tooLittleOrMuch:
      "For lidt over tid øger risikoen for knogleskørhed. Meget store tilskud kan give nyresten hos disponerede.",
    searchTerm: "calcium",
  },
  {
    key: "iron",
    group: "mineral",
    name: "Jern",
    alsoKnownAs: "Fe",
    function: "Bidrager til dannelse af hæmoglobin og transport af ilt i kroppen.",
    sources: "Rødt kød, lever, bælgfrugter, fuldkorn og grønne bladgrøntsager.",
    referenceIntake: "14 mg pr. dag",
    tooLittleOrMuch:
      "Kvinder i den fødedygtige alder har oftere for lidt. Tilskud bør kun tages efter behov — for meget jern kan være skadeligt.",
    searchTerm: "iron",
  },
  {
    key: "sodium",
    group: "mineral",
    name: "Natrium",
    alsoKnownAs: "Del af salt (natriumklorid)",
    function: "Regulerer kroppens væskebalance og bidrager til nerve- og muskelfunktion.",
    sources: "Primært salt — brød, pålæg, ost, færdigretter og snacks.",
    referenceIntake: "Højst ca. 2,4 g pr. dag (svarer til 6 g salt)",
    tooLittleOrMuch: "De fleste danskere får for meget; et højt saltindtag øger blodtrykket.",
    searchTerm: "sodium",
  },
  {
    key: "potassium",
    group: "mineral",
    name: "Kalium",
    alsoKnownAs: "K",
    function: "Bidrager til normal funktion af nerver og muskler og til et normalt blodtryk.",
    sources: "Kartofler, bananer, grøntsager, bælgfrugter og mælkeprodukter.",
    referenceIntake: "2000 mg pr. dag",
    tooLittleOrMuch:
      "Personer med nedsat nyrefunktion skal være varsomme med kaliumtilskud og kaliumholdigt salterstatning.",
    searchTerm: "potassium",
  },
  {
    key: "magnesium",
    group: "mineral",
    name: "Magnesium",
    alsoKnownAs: "Mg",
    function: "Bidrager til normal energiomsætning, muskel- og nervefunktion og knogler.",
    sources: "Fuldkorn, nødder, frø, bælgfrugter og grønne grøntsager.",
    referenceIntake: "375 mg pr. dag",
    tooLittleOrMuch: "Store tilskud kan give diarré; fra almindelig kost er det ikke et problem.",
    searchTerm: "magnesium",
  },
  {
    key: "zinc",
    group: "mineral",
    name: "Zink",
    alsoKnownAs: "Zn",
    function: "Bidrager til normalt immunforsvar, sårheling og normal hud, hår og negle.",
    sources: "Kød, skaldyr, ost, fuldkorn, nødder og bælgfrugter.",
    referenceIntake: "10 mg pr. dag",
    tooLittleOrMuch: "Store tilskud over længere tid kan hæmme optagelsen af kobber.",
    searchTerm: "zinc",
  },
  {
    key: "copper",
    group: "mineral",
    name: "Kobber",
    alsoKnownAs: "Cu",
    function: "Bidrager til normal jerntransport, bindevæv og immunforsvar.",
    sources: "Lever, skaldyr, nødder, frø, fuldkorn og kakao.",
    referenceIntake: "1 mg pr. dag",
    tooLittleOrMuch: "Mangel er sjælden. Meget store mængder kan belaste leveren.",
    searchTerm: "copper",
  },
  {
    key: "manganese",
    group: "mineral",
    name: "Mangan",
    alsoKnownAs: "Mn",
    function: "Bidrager til normal energiomsætning, knogler og beskyttelse af cellerne.",
    sources: "Fuldkorn, nødder, te, bælgfrugter og grønne grøntsager.",
    referenceIntake: "2 mg pr. dag",
    tooLittleOrMuch: "Mangel er meget sjælden ved almindelig kost.",
    searchTerm: "manganese",
  },
  {
    key: "selenium",
    group: "mineral",
    name: "Selen",
    alsoKnownAs: "Se",
    function: "Bidrager til normalt immunforsvar, normal stofskiftefunktion og beskyttelse af cellerne.",
    sources: "Fisk, skaldyr, æg, kød og paranødder.",
    referenceIntake: "55 µg pr. dag",
    tooLittleOrMuch: "Paranødder indeholder meget — få om dagen er nok. For meget selen er skadeligt.",
    searchTerm: "selenium",
  },
  {
    key: "phosphorus",
    group: "mineral",
    name: "Fosfor",
    alsoKnownAs: "P",
    function: "Bidrager til normale knogler og tænder og til energiomsætningen.",
    sources: "Mælkeprodukter, kød, fisk, fuldkorn og bælgfrugter; tilsættes også som fosfater (E338–E343).",
    referenceIntake: "700 mg pr. dag",
    tooLittleOrMuch:
      "Mangel er sjælden. Personer med nedsat nyrefunktion bør begrænse fosfor, bl.a. fra tilsatte fosfater.",
    searchTerm: "phosphorus",
  },
  {
    key: "iodine",
    group: "mineral",
    name: "Jod",
    alsoKnownAs: "I",
    function: "Bidrager til normal produktion af stofskiftehormoner og normal kognitiv funktion.",
    sources: "Fisk, skaldyr, mælkeprodukter og joderet salt (bl.a. i brød).",
    referenceIntake: "150 µg pr. dag",
    tooLittleOrMuch:
      "Både for lidt og for meget kan påvirke stofskiftet. Tang og tangtilskud kan indeholde meget store mængder.",
    searchTerm: "iodine",
  },
];

export const MICRONUTRIENT_INFO_BY_KEY: Partial<Record<string, MicronutrientInfo>> = Object.fromEntries(
  MICRONUTRIENT_INFO.map((info) => [info.key, info]),
);

export function micronutrientAnchor(key: string): string {
  return key.toLowerCase();
}

export function micronutrientHref(key: string): string {
  return `/vitaminer#${micronutrientAnchor(key)}`;
}

export type MicronutrientLink = { label: string; href: string };

// Troværdige kilder til videre læsning om samme vitamin/mineral.
export function micronutrientSources(info: MicronutrientInfo): MicronutrientLink[] {
  const term = encodeURIComponent(info.searchTerm);
  return [
    { label: "Fødevarestyrelsen (altomkost.dk)", href: `https://altomkost.dk/soeg/?q=${encodeURIComponent(info.name)}` },
    { label: "EFSA", href: "https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values" },
    { label: "PubMed", href: `https://pubmed.ncbi.nlm.nih.gov/?term=${term}%20nutrition` },
    { label: "Wikipedia", href: `https://en.wikipedia.org/wiki/Special:Search?search=${term}` },
  ];
}

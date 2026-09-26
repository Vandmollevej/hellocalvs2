// Toksiner på produktsiden (G11, docs/DECISIONS.md 2026-09-24): en kurateret
// liste over kendte uønskede stoffer i bestemte fødevarer — naturlige
// plantegifte, skimmelgifte, tungmetaller og stoffer der dannes ved stegning.
// Hver post bygger på Fødevarestyrelsens (FVST) eller EFSA's egne sider, og
// graviditet/amning/fertilitet er kun udfyldt, hvor FVST selv giver et råd.
//
// Matching sker mod produktnavn + indholdsfortegnelse (Product.ingredientsText).
// Et fund betyder "denne type fødevare er kendt for stoffet", ikke at det
// konkrete produkt er målt — det står også i UI'et.

export type ToxinInfo = {
  key: string;
  name: string;
  foods: string;
  description: string;
  advice: string;
  // FVST-råd til gravide og ammende (kostraad-til-dig/gravid-eller-ammende).
  pregnancy: string | null;
  fertility: string | null;
  links: { label: string; url: string }[];
  // Små bogstaver. "=ord" matcher kun hele ord; ellers matcher termen
  // hvor som helst i teksten (så danske sammensatte ord fanges).
  terms: string[];
  // Springer stoffet over, hvis en af disse findes (fx "alkoholfri").
  excludeIf?: string[];
};

const FVST = "https://foedevarestyrelsen.dk/kost-og-foedevarer";
const FVST_PREGNANCY = {
  label: "Fødevarestyrelsen: Gravid eller ammende",
  url: `${FVST}/alt-om-mad/de-officielle-kostraad/kostraad-til-dig/gravid-eller-ammende`,
};
const fvst = (label: string, path: string) => ({ label: `Fødevarestyrelsen: ${label}`, url: `${FVST}/${path}` });
const MAD = "alt-om-mad/kemi-i-maden/mad-med-uoensket-kemi";
const KEMI = "alt-om-mad/kemi-i-maden/uoensket-kemi-i-mad";
const NATUR = "foedevaresikkerhed/kemiske-stoffer-og-toksiner/naturlige-giftstoffer";

export const TOXINS: ToxinInfo[] = [
  {
    key: "alcohol",
    name: "Alkohol",
    foods: "Øl, vin, spiritus og mad tilsat alkohol",
    description: "Alkohol passerer moderkagen og kan skade fosterets udvikling.",
    advice: "Følg de generelle råd om alkohol.",
    pregnancy: "Undgå alkohol helt under graviditeten.",
    fertility: "Fødevarestyrelsen råder til at undgå alkohol allerede, når man planlægger at blive gravid.",
    links: [FVST_PREGNANCY],
    terms: ["alkohol", "=øl", "pilsner", "=vin", "rødvin", "hvidvin", "portvin", "sherry", "spiritus", "likør", "vodka", "whisky", "cognac", "brandy", "=rom", "=alcohol", "=beer", "=wine"],
    excludeIf: ["alkoholfri", "alcohol free", "alcohol-free"],
  },
  {
    key: "caffeine",
    name: "Koffein",
    foods: "Kaffe, te, cola, energidrikke og guarana",
    description: "Store mængder koffein kan give hjertebanken, uro og søvnbesvær.",
    advice: "Voksne kan typisk tåle op til 400 mg koffein om dagen (EFSA).",
    pregnancy: "Højst 2 kopper kaffe og 2 kopper te om dagen, ingen energidrikke og højst ½ liter cola om ugen. Koffein passerer moderkagen til fosteret.",
    fertility: null,
    links: [fvst("Kaffe", `${MAD}/kaffe`), FVST_PREGNANCY, { label: "EFSA: Caffeine", url: "https://www.efsa.europa.eu/en/topics/topic/caffeine" }],
    terms: ["kaffe", "coffee", "espresso", "=te", "sort te", "grøn te", "=tea", "=cola", "energidrik", "energy drink", "guarana", "koffein", "caffeine"],
  },
  {
    key: "glycyrrhizin",
    name: "Glycyrrhizinsyre",
    foods: "Lakrids og salmiak",
    description: "Glycyrrhizinsyre fra lakridsrod kan give væskeophobning og forhøjet blodtryk.",
    advice: "Voksne højst 50 g lakrids om dagen, børn højst 25 g. Personer med forhøjet blodtryk bør spise mindre.",
    pregnancy: "Højst 50 g lakrids om dagen, mindre af stærk lakrids og højst 2 g ren lakrids.",
    fertility: null,
    links: [fvst("Lakrids", `${MAD}/lakrids`), fvst("Glycyrrhizinsyre", `${NATUR}/glycyrrhizinsyre`)],
    terms: ["lakrids", "salmiak", "liquorice", "licorice"],
  },
  {
    key: "mercury",
    name: "Kviksølv",
    foods: "Tun og store rovfisk som gedde, aborre, sværdfisk og haj",
    description: "Kviksølv ophobes i store rovfisk og kan skade nervesystemet, særligt hos fostre og børn.",
    advice: "Spis varieret fisk, og begræns de store rovfisk.",
    pregnancy: "Undgå frisk tun, spis højst én dåse tun om ugen, og vær varsom med store rovfisk som gedde, aborre og oliefisk.",
    fertility: null,
    links: [fvst("Kviksølv", `${KEMI}/kviksoelv`), FVST_PREGNANCY],
    terms: ["=tun", "tunfisk", "=tuna", "sværdfisk", "swordfish", "gedde", "aborre", "oliefisk", "=haj", "=shark"],
  },
  {
    key: "dioxin",
    name: "Dioxin og PCB",
    foods: "Østersølaks og torskelever",
    description: "Miljøgifte, der ophobes i fedtet i fisk fra forurenede farvande.",
    advice: "Begræns fed fisk fra Østersøen.",
    pregnancy: "Højst 125 g østersølaks om måneden, og undgå torskelever.",
    fertility: null,
    links: [FVST_PREGNANCY, { label: "EFSA: Dioxins and PCBs", url: "https://www.efsa.europa.eu/en/topics/topic/dioxins-and-pcbs" }],
    terms: ["østersølaks", "baltic salmon", "torskelever", "cod liver"],
  },
  {
    key: "retinol",
    name: "Højt indhold af A-vitamin (retinol)",
    foods: "Lever og leverpostej",
    description: "Meget store mængder retinol kan skade fosteret.",
    advice: "Almindelige mængder leverpostej er uproblematiske for de fleste.",
    pregnancy: "Undgå lever, og spis kun leverpostej i små mængder.",
    fertility: null,
    links: [fvst("Lever", `${MAD}/lever`), FVST_PREGNANCY],
    terms: ["lever", "=liver"],
  },
  {
    key: "iodine",
    name: "Højt jodindhold",
    foods: "Tang som kombu, wakame, arame, fingertang og sukkertang",
    description: "Nogle tangarter indeholder så meget jod, at det kan påvirke skjoldbruskkirtlen.",
    advice: "Begræns brunalger. Nori (sushi-tang) er fint.",
    pregnancy: "Undgå eller begræns tang som kombu, wakame, arame, fingertang og sukkertang. Nori er fint.",
    fertility: null,
    links: [fvst("Tang", `${MAD}/tang`), FVST_PREGNANCY],
    terms: ["=tang", "fingertang", "sukkertang", "kombu", "wakame", "arame", "=kelp", "hijiki"],
  },
  {
    key: "arsenic",
    name: "Uorganisk arsen",
    foods: "Ris, risdrik, riskiks og hijiki-tang",
    description: "Uorganisk arsen er kræftfremkaldende. Brune og røde ris indeholder næsten dobbelt så meget som hvide.",
    advice: "Børn bør ikke drikke risdrik, og voksne bør begrænse det. Undgå hijiki-tang.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Arsen", `${KEMI}/arsen`)],
    terms: ["=ris", "risdrik", "riskiks", "rismel", "risengrød", "basmatiris", "jasminris", "fuldkornsris", "=rice", "hijiki"],
  },
  {
    key: "cadmium",
    name: "Cadmium",
    foods: "Hørfrø, solsikkekerner, muslinger, rejer og mørk chokolade",
    description: "Cadmium ophobes i nyrer og lever over mange år og kan skade nyrerne.",
    advice: "Spis varieret, og undgå store mængder af én cadmiumrig fødevare. 25 g hørfrø om dagen giver en tredjedel af den tålelige ugentlige mængde.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Cadmium", `${KEMI}/cadmium`)],
    terms: ["hørfrø", "flaxseed", "linseed", "solsikkekerne", "sunflower seed", "muslinger", "mussel", "rejer", "shrimp", "mørk chokolade", "dark chocolate"],
  },
  {
    key: "cyanogenicGlycosides",
    name: "Cyanogene glykosider (blåsyre)",
    foods: "Hørfrø, abrikoskerner, bitre mandler og cassava",
    description: "Kan omdannes til blåsyre i kroppen og give akut forgiftning ved store mængder.",
    advice: "Spis ikke store mængder knuste hørfrø ad gangen, og undgå rå abrikoskerner og bitre mandler.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Hørfrø", `${MAD}/hoerfroe`), fvst("Cyanogene glykosider", `${NATUR}/cyanogene-glykosider`)],
    terms: ["hørfrø", "linfrø", "flaxseed", "linseed", "abrikoskerne", "bitre mandler", "bittermandel", "bitter almond", "cassava", "maniok"],
  },
  {
    key: "solanine",
    name: "Solanin",
    foods: "Kartofler, grønne tomater og aubergine",
    description: "Glykoalkaloid, der kan give mave-tarm-gener. Findes især i grønne pletter og spirer på kartofler.",
    advice: "Kassér kartofler med grønne pletter, og opbevar kartofler mørkt. Almindelige kartoffelprodukter er uproblematiske.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Kartofler", `${MAD}/kartofler`), fvst("Naturlige toksiner i planter", `${KEMI}/naturlige-toksiner-i-planter`)],
    terms: ["kartoffel", "kartofler", "potato", "aubergine", "eggplant", "grønne tomater"],
  },
  {
    key: "lectins",
    name: "Lektiner",
    foods: "Tørrede bønner, fx kidneybønner",
    description: "Rå eller for lidt kogte bønner kan give opkast og diarré.",
    advice: "Udblød og kog tørrede bønner grundigt. Bønner på dåse er allerede kogte.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Bønner", `${MAD}/boenner`), fvst("Lektiner", `${NATUR}/lektiner`)],
    terms: ["kidneybønne", "kidney bean", "røde bønner", "hvide bønner", "sorte bønner", "limabønne", "borlottibønne"],
  },
  {
    key: "cucurbitacins",
    name: "Cucurbitaciner",
    foods: "Squash, zucchini og græskar",
    description: "Bitre stoffer, der kan give kraftig maveforgiftning. Kun et problem, når grøntsagen smager bittert.",
    advice: "Smager squash eller græskar bittert, så spyt det ud og kassér resten.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Squash", `${MAD}/squash`), fvst("Cucurbitaciner", `${NATUR}/cucurbitaciner`)],
    terms: ["squash", "zucchini", "courgette", "græskar", "pumpkin"],
  },
  {
    key: "coumarin",
    name: "Kumarin",
    foods: "Kassiakanel (almindelig kanel) og tonkabønner",
    description: "Kan skade leveren ved store mængder. Ceylonkanel indeholder meget lidt.",
    advice: "Vælg ceylonkanel, hvis du bruger meget kanel.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Kumarin", `${KEMI}/kumarin`)],
    terms: ["kanel", "cinnamon", "kassia", "cassia", "tonka"],
  },
  {
    key: "myristicin",
    name: "Myristicin",
    foods: "Muskatnød og muskatblomme",
    description: "Kan give forgiftning ved omkring 5 g eller mere (en hel muskatnød).",
    advice: "Op til 1 tsk revet muskatnød i en ret til fire er uproblematisk.",
    pregnancy: "Samme råd gælder for gravide.",
    fertility: null,
    links: [fvst("Muskatnød", `${MAD}/muskatnoed`)],
    terms: ["muskat", "nutmeg", "macis"],
  },
  {
    key: "furocoumarins",
    name: "Furokumariner",
    foods: "Selleri og pastinak",
    description: "Kan gøre huden mere følsom over for sollys.",
    advice: "Almindelige mængder i maden er uproblematiske.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Furokumariner", `${NATUR}/furokumariner`)],
    terms: ["selleri", "celery", "pastinak", "parsnip"],
  },
  {
    key: "tropaneAlkaloids",
    name: "Tropanalkaloider",
    foods: "Boghvede, hirse og sorghum",
    description: "Kommer fra ukrudtsfrø, der kan blive høstet med kornet, og kan påvirke nervesystemet.",
    advice: "Spis varieret korn.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Tropanalkaloider", `${NATUR}/tropanalkaloider`)],
    terms: ["boghvede", "buckwheat", "hirse", "millet", "sorghum"],
  },
  {
    key: "pyrrolizidineAlkaloids",
    name: "Pyrrolizidinalkaloider (PA)",
    foods: "Urtete, rooibos og kamillete",
    description: "Kommer fra ukrudt, der høstes med te-planterne, og kan skade leveren.",
    advice: "Skift mellem forskellige te-typer og mærker. Børn under 3 år bør ikke drikke te.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Te", `${MAD}/te`)],
    terms: ["urtete", "herbal tea", "rooibos", "kamille", "chamomile", "borago"],
  },
  {
    key: "acrylamide",
    name: "Akrylamid",
    foods: "Chips, pommes frites, knækbrød, kiks og kaffe",
    description: "Dannes, når stivelsesrige fødevarer steges, bages eller ristes ved høj temperatur, og er muligvis kræftfremkaldende.",
    advice: "Steg og bag til gyldne, ikke brune, og spis varieret.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Akrylamid", `${KEMI}/akrylamid`), { label: "EFSA: Acrylamide", url: "https://www.efsa.europa.eu/en/topics/topic/acrylamide" }],
    terms: ["=chips", "kartoffelchips", "tortillachips", "potato chips", "pommes frites", "french fries", "knækbrød", "crispbread", "=kiks"],
  },
  {
    key: "mycotoxins",
    name: "Skimmelsvampegifte (aflatoksin, okratoksin A)",
    foods: "Jordnødder, pistacienødder, paranødder, tørrede figner, rosiner og chili",
    description: "Giftstoffer fra skimmelsvampe. Aflatoksin er kræftfremkaldende.",
    advice: "Kassér nødder og tørret frugt, der er mugne eller smager harskt. Børn under 3 år højst ca. 50 g rosiner om ugen.",
    pregnancy: null,
    fertility: null,
    links: [fvst("Rosiner", `${MAD}/rosiner`), { label: "EFSA: Mycotoxins", url: "https://www.efsa.europa.eu/en/topics/topic/mycotoxins" }],
    terms: ["jordnød", "peanut", "pistacie", "pistachio", "paranød", "brazil nut", "figen", "figner", "=fig", "=figs", "rosin", "raisin", "chili"],
  },
  {
    key: "ginger",
    name: "Ingefær i høje doser",
    foods: "Ingefærshots og kosttilskud med ingefær",
    description: "Koncentreret ingefær kan påvirke blodets størkning.",
    advice: "Almindelig mad med ingefær er uproblematisk.",
    pregnancy: "Undgå ingefærshots og kosttilskud med ingefær. Mad med ingefær er fint.",
    fertility: null,
    links: [fvst("Ingefær", `${MAD}/ingefaer`), FVST_PREGNANCY],
    terms: ["ingefær", "ginger"],
  },
  {
    key: "nitrate",
    name: "Nitrat",
    foods: "Koncentreret rødbedesaft",
    description: "Store mængder nitrat kan omdannes til nitrit i kroppen.",
    advice: "Almindelige mængder rødbeder er uproblematiske.",
    pregnancy: "Vær varsom med koncentreret rødbedesaft og rødbedeshots.",
    fertility: null,
    links: [FVST_PREGNANCY],
    terms: ["rødbedesaft", "rødbedejuice", "rødbedeshot", "beetroot juice", "beet juice"],
  },
  {
    key: "pregnancyHerbs",
    name: "Urter, gravide bør undgå",
    foods: "Perikon, tulsi (hellig basilikum), ginseng og ashwagandha",
    description: "Urter med virkning på hormoner eller medicin.",
    advice: "Tal med din læge, hvis du tager medicin.",
    pregnancy: "Undgå perikon, tulsi (hellig basilikum), ginseng og ashwagandha.",
    fertility: null,
    links: [FVST_PREGNANCY],
    terms: ["perikon", "st. john's wort", "tulsi", "hellig basilikum", "holy basil", "ginseng", "ashwagandha"],
  },
];

export type ToxinMatch = { toxin: ToxinInfo; matchedTerm: string };

const LETTER = "a-z0-9æøåäöüé";

function termMatches(text: string, term: string): boolean {
  if (!term.startsWith("=")) return text.includes(term);
  const word = term.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^${LETTER}])${word}($|[^${LETTER}])`).test(text);
}

/** Kendte toksiner for et produkt ud fra navn + indholdsfortegnelse. Stoffer
 * med råd til gravide/ammende eller fertilitet sorteres først. */
export function matchToxins(...texts: Array<string | null | undefined>): ToxinMatch[] {
  const text = texts.filter(Boolean).join(" \n ").toLowerCase();
  if (!text.trim()) return [];
  const matches: ToxinMatch[] = [];
  for (const toxin of TOXINS) {
    if (toxin.excludeIf?.some((word) => text.includes(word))) continue;
    const hit = toxin.terms.find((term) => termMatches(text, term));
    if (hit) matches.push({ toxin, matchedTerm: hit.replace(/^=/, "") });
  }
  const priority = (m: ToxinMatch) => (m.toxin.pregnancy || m.toxin.fertility ? 0 : 1);
  return matches.sort((a, b) => priority(a) - priority(b));
}

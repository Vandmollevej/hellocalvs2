// Tale på Madvarer (docs/DECISIONS.md 2026-10-16): mikrofonen skriver hele
// sætningen i søgefeltet ("Jeg har spist en bakke pomfritter"), men søgningen
// kan kun finde varen ("pomfritter"). Her skrælles indledningen ("jeg har
// spist"), mængde og enhed ("en bakke") og tidsangivelser ("til frokost") af,
// så det, der søges på, er selve varen. Gælder alle mikrofonens sprog.
// Pure and import-free so `npm test` can load it directly.

// Indledninger: "jeg har (lige) spist", "I just had", "ich habe … gegessen" osv.
const LEAD_PHRASES = [
  // da / nb / sv
  String.raw`(?:jeg|vi|eg|jag)\s+(?:har\s+|hev\s+|hade\s+|havde\s+)?(?:lige\s+|nettopp\s+|nyss\s+|just\s+|precis\s+|bare\s+)?(?:spist|spiste|spiser|åt|ätit|äter|et|drukket|drak|drikker|drikk|druckit|drack|dricker|fået|fik|fått|fick|haft|hatt|indtaget|tagit|taget)`,
  String.raw`(?:jeg|eg|jag)\s+(?:vil|skal|ska|kommer\s+til\s+at)\s+(?:gerne\s+|gärna\s+)?(?:have|ha|spise|äta|drikke|dricka|registrere|registrera|logge|logga|tilføje|lägga\s+till|legge\s+til)`,
  String.raw`(?:registrer|registrera|log|logg|logga|tilføj|tilfoej|legg\s+til|lägg\s+till)`,
  // en
  String.raw`(?:i|we)\s+(?:have\s+|'ve\s+|just\s+|had\s+)*(?:just\s+)?(?:eaten|ate|eat|had|have|drank|drunk|drink|consumed)`,
  String.raw`(?:i'm|i\s+am|we're|we\s+are)\s+(?:eating|having|drinking)`,
  String.raw`(?:add|log|register)`,
  // de
  String.raw`(?:ich|wir)\s+(?:habe|haben|hab)(?:\s+gerade|\s+eben)?`,
  String.raw`(?:ich|wir)\s+(?:esse|essen|trinke|trinken|aß|aßen|trank|tranken)`,
  // nl
  String.raw`(?:ik|wij|we)\s+(?:heb|hebben)(?:\s+net|\s+zojuist)?`,
  String.raw`(?:ik|wij|we)\s+(?:eet|eten|drink|drinken|at|aten|dronk|dronken)`,
  // fr
  String.raw`(?:j'ai|nous\s+avons)\s+(?:juste\s+)?(?:mangé|mange|bu|pris)`,
  String.raw`(?:je|nous)\s+(?:mange|mangeons|bois|buvons)`,
  // it
  String.raw`(?:ho|abbiamo)\s+(?:appena\s+)?(?:mangiato|bevuto|preso)`,
  // es
  String.raw`(?:he|hemos)\s+(?:comido|bebido|tomado)`,
  String.raw`(?:comí|bebí|tomé)`,
];

// Efterled på tysk/hollandsk ("… gegessen", "… gegeten").
const TRAIL_VERBS = String.raw`(?:gegessen|getrunken|gehabt|gegeten|gedronken)`;

// Tidsangivelser til sidst: "til frokost", "i dag", "for breakfast" …
const TRAIL_TIME = String.raw`(?:(?:til|for|zum|zu|als|pour|au|per|a|para|en|i|till|til|in|vor|om|à|al|a\s+la)\s+)?(?:morgenmad|frokost|aftensmad|middag|mellemmåltid|snack|frukost|lunsj|lunch|middag|kvällsmat|kveldsmat|breakfast|dinner|supper|frühstück|mittag|mittagessen|abendessen|abendbrot|ontbijt|avondeten|petit[- ]déjeuner|déjeuner|dîner|colazione|pranzo|cena|desayuno|almuerzo|comida|i\s+dag|idag|i\s+går|igår|i\s+morges|i\s+aftes|today|yesterday|this\s+morning|tonight|heute|gestern|vandaag|gisteren|aujourd'hui|hier|oggi|ieri|hoy|ayer)`;

// Mængde: tal, talord og "en halv" på alle mikrofonens sprog.
const AMOUNT = String.raw`(?:\d+(?:[.,]\d+)?|½|¼|¾|en|et|ett|ei|én|ét|to|två|tre|fire|fyra|fem|seks|sex|halv|halvt|halve|halva|en\s+halv|et\s+halvt|a|an|one|two|three|four|five|half|a\s+half|ein|eine|einen|einem|einer|zwei|drei|vier|fünf|halbe|halben|een|één|twee|drie|vier|vijf|halve|un|une|deux|trois|quatre|cinq|demi|uno|una|due|tre|quattro|cinque|mezzo|mezza|dos|tres|cuatro|cinco|medio|media|nogle|noen|några|some|etwas|wat|du|de\s+la|des|del|della|unos|unas)`;

// Enhed/beholder efter mængden: "bakke", "glas", "skiver", "portion" …
const UNIT = String.raw`(?:bakke|bakker|glas|glass|kop|kopper|kopp|koppar|skål|skåle|skåler|skålar|tallerken|tallerkner|tallrik|portion|portioner|porsjon|porsjoner|stk|stykke|stykker|stycken|styck|skive|skiver|skiva|skivor|håndfuld|håndfull|näve|pose|poser|påse|dåse|dåser|boks|bokser|burk|flaske|flasker|flaska|liter|l|dl|cl|ml|gram|g|kg|tray|trays|box|bowl|bowls|cup|cups|glasses|plate|plates|portions|serving|servings|slice|slices|piece|pieces|handful|bag|bags|can|cans|bottle|bottles|packet|pack|schale|schüssel|tasse|tassen|teller|stück|scheibe|scheiben|handvoll|tüte|dose|flasche|flaschen|bakje|kom|kopje|bord|stuk|stukken|plak|plakken|zak|blikje|fles|barquette|bol|tasse|assiette|tranche|tranches|morceau|poignée|sachet|canette|bouteille|vaschetta|ciotola|tazza|piatto|porzione|fetta|fette|pezzo|manciata|bottiglia|bandeja|cuenco|taza|plato|ración|rebanada|trozo|puñado|bolsa|lata|botella)`;

// Bindeord mellem enhed og vare: "a bowl of", "ein Glas", "un bol de".
const OF = String.raw`(?:of|med|af|av|mit|met|de|d'|di|del|de\s+la)`;

const leadPattern = new RegExp(String.raw`^(?:${LEAD_PHRASES.join("|")})(?:\s+|$)`, "iu");
const trailVerbPattern = new RegExp(String.raw`\s+${TRAIL_VERBS}$`, "iu");
const trailTimePattern = new RegExp(String.raw`\s+${TRAIL_TIME}$`, "iu");
const amountUnitPattern = new RegExp(
  String.raw`^${AMOUNT}(?:\s+(?:stor|store|lille|små|stort|lidt|large|small|big|grande|petit|petite|piccolo|großen|große|großes|kleine|kleinen)\s+)?(?:\s*${UNIT}\.?)?(?:\s+${OF})?(?:\s+|$)`,
  "iu"
);
const unitOnlyPattern = new RegExp(String.raw`^${UNIT}(?:\s+${OF})?\s+`, "iu");

/**
 * Det sagte → det, der skal søges på. `spoken` er sand, når teksten starter
 * som en talt sætning ("jeg har spist …") — så søges der kun på varen. Ellers
 * er `query` blot et forslag, som søgningen bruger, hvis originalen intet
 * finder ("Tre Stjerner" må ikke miste "Tre"). Aldrig en tom streng: bliver
 * intet tilbage, gives originalen.
 */
export function parseSpokenFoodQuery(text: string): { query: string; spoken: boolean } {
  const original = text.trim().replace(/\s+/g, " ");
  let rest = original.replace(/[.!?]+$/u, "").trim();

  const lead = rest.replace(leadPattern, "");
  const hadLead = lead !== rest;
  rest = lead.trim();
  for (let i = 0; i < 2; i += 1) {
    rest = rest.replace(trailVerbPattern, "").replace(trailTimePattern, "").trim();
  }
  // Mængde/enhed skrælles kun af, når de står foran en vare ("en bakke
  // pomfritter"); et enkelt ord som "Mælk" eller "Øl" røres ikke.
  const withoutAmount = rest.replace(amountUnitPattern, "").trim();
  if (withoutAmount && (hadLead || /\s/.test(rest))) rest = withoutAmount;
  const withoutUnit = rest.replace(unitOnlyPattern, "").trim();
  if (withoutUnit && hadLead) rest = withoutUnit;

  if (rest.length < 2) return { query: original, spoken: false };
  return { query: rest, spoken: hadLead };
}

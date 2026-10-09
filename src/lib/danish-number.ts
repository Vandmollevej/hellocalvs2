// Ental/flertal for generiske ingredienser (docs/REGLER.md "Produkttype: ental
// og flertal"). Søgning efter "et æble" må ikke vise "æbler" og omvendt, så
// hver GenericIngredient har både nameSingular og namePlural. Hvor formen ikke
// kan afgøres (eller ental = flertal, fx "æg"), er teksten ens i begge felter.

const PAIRS =
  "abrikos/abrikoser agurk/agurker ananas/ananasser appelsin/appelsiner aubergine/auberginer avocado/avocadoer banan/bananer blomme/blommer bønne/bønner citron/citroner clementin/clementiner dadel/dadler drue/druer fersken/ferskner figen/figner granatæble/granatæbler grapefrugt/grapefrugter gulerod/gulerødder kartoffel/kartofler kantarel/kantareller kikært/kikærter kiwi/kiwier mango/mangoer nektarin/nektariner pastinak/pastinakker peberfrugt/peberfrugter pære/pærer porre/porrer radise/radiser rødbede/rødbeder tomat/tomater vindrue/vindruer ært/ærter champignon/champignoner cherrytomat/cherrytomater skoleagurk/skoleagurker kotelet/koteletter pølse/pølser bøf/bøffer kyllingebryst/kyllingebryster kylling/kyllinger wrap/wraps bolle/boller kage/kager svamp/svampe æble/æbler melon/meloner fennikel/fennikler ost/oste";

const SINGULAR_TO_PLURAL = new Map<string, string>();
const PLURAL_TO_SINGULAR = new Map<string, string>();
for (const pair of PAIRS.split(" ")) {
  const [singular, plural] = pair.split("/");
  SINGULAR_TO_PLURAL.set(singular, plural);
  if (!PLURAL_TO_SINGULAR.has(plural)) PLURAL_TO_SINGULAR.set(plural, singular);
}

// Flertalsform af et tillægsord -> ental (kun det mest almindelige).
const ADJECTIVE_PLURAL_TO_SINGULAR = new Map<string, string>([
  ["grønne", "grøn"], ["røde", "rød"], ["store", "stor"], ["friske", "frisk"],
  ["modne", "moden"], ["løse", "løs"], ["sorte", "sort"], ["hvide", "hvid"], ["gule", "gul"],
]);
const ADJECTIVE_SINGULAR_TO_PLURAL = new Map(
  [...ADJECTIVE_PLURAL_TO_SINGULAR].map(([plural, singular]) => [singular, plural] as const)
);

function matchCase(source: string, word: string): string {
  return source[0] && source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()
    ? word.charAt(0).toUpperCase() + word.slice(1)
    : word;
}

export type NumberForms = { singular: string; plural: string };

export function deriveNumberForms(name: string): NumberForms {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  const head = words[words.length - 1] ?? "";
  const lower = head.toLowerCase();
  const knownPlural = PLURAL_TO_SINGULAR.get(lower);
  const knownSingular = SINGULAR_TO_PLURAL.get(lower);
  if (!knownPlural && !knownSingular) return { singular: trimmed, plural: trimmed };

  const singularHead = knownPlural ?? lower;
  const pluralHead = knownSingular ?? lower;
  const singularWords = [...words.slice(0, -1)];
  const pluralWords = [...words.slice(0, -1)];
  const modifier = singularWords[singularWords.length - 1]?.toLowerCase();
  if (modifier && ADJECTIVE_PLURAL_TO_SINGULAR.has(modifier)) {
    singularWords[singularWords.length - 1] = matchCase(
      singularWords[singularWords.length - 1],
      ADJECTIVE_PLURAL_TO_SINGULAR.get(modifier)!
    );
  } else if (modifier && ADJECTIVE_SINGULAR_TO_PLURAL.has(modifier)) {
    pluralWords[pluralWords.length - 1] = matchCase(
      pluralWords[pluralWords.length - 1],
      ADJECTIVE_SINGULAR_TO_PLURAL.get(modifier)!
    );
  }
  return {
    singular: [...singularWords, matchCase(head, singularHead)].join(" "),
    plural: [...pluralWords, matchCase(head, pluralHead)].join(" "),
  };
}

export type NumberQuery = { term: string; number: "singular" | "plural" | "any" };

// "et æble" / "en banan" = ental, "nogle æbler" / "flere æbler" = flertal.
export function parseNumberQuery(query: string): NumberQuery {
  const q = query.trim();
  const singular = /^(et|en)\s+(.+)$/i.exec(q);
  if (singular) return { term: singular[2].trim(), number: "singular" };
  const plural = /^(nogle|flere|mange)\s+(.+)$/i.exec(q);
  if (plural) return { term: plural[2].trim(), number: "plural" };
  return { term: q, number: "any" };
}

function hasWord(text: string, term: string): boolean {
  const needle = term.toLowerCase();
  return text.toLowerCase().split(/\s+/).some((word) => word === needle);
}

// Ental-søgning matcher kun hele ord i ental-feltet (ikke "æbler" for "æble");
// flertals-søgning kun hele ord i flertals-feltet. Uden artikel gælder den
// almindelige delstrengssøgning uændret.
export function matchesNumberQuery(
  ingredient: { name: string; nameSingular?: string | null; namePlural?: string | null },
  query: NumberQuery
): boolean {
  if (query.number === "singular") return hasWord(ingredient.nameSingular ?? ingredient.name, query.term);
  if (query.number === "plural") return hasWord(ingredient.namePlural ?? ingredient.name, query.term);
  return true;
}

export function displayNameForQuery(
  ingredient: { name: string; nameSingular?: string | null; namePlural?: string | null },
  query: NumberQuery
): string {
  if (query.number === "singular") return ingredient.nameSingular ?? ingredient.name;
  if (query.number === "plural") return ingredient.namePlural ?? ingredient.name;
  return ingredient.name;
}

// Certificeringer ("Øko", Nøglehul osv.) vises som logoer på varesiden i
// stedet for som tekst i titlen (docs/DECISIONS.md 2026-09-28). Vi har ingen
// struktureret certificeringskolonne endnu, så de udledes af varenavnet.

export type Certification = "organic" | "keyhole" | "fairtrade" | "msc";

const PATTERNS: { id: Certification; pattern: RegExp }[] = [
  { id: "organic", pattern: /\b(?:økologisk[e]?|øko|oeko|organic|bio)\b\.?/giu },
  { id: "keyhole", pattern: /\bnøglehul(?:smærket)?\b/giu },
  { id: "fairtrade", pattern: /\bfair\s?trade\b/giu },
  { id: "msc", pattern: /\bmsc(?:-mærket)?\b/giu },
];

// \b virker ikke omkring æøå i JS-regex, så ordgrænser tjekkes manuelt.
function wordRegex(source: RegExp) {
  const body = source.source.replace(/\\b/g, "");
  return new RegExp(`(^|[^\\p{L}\\p{N}])(?:${body})(?=$|[^\\p{L}\\p{N}])`, "giu");
}

// "Fedt" efter procenttegnet må ikke stå i H1/H2 (der er ikke plads, og for
// mejeri, alkohol og oste er det underforstået). Det må stå i varetekst mv.
export function stripFatWord(text: string): string {
  return text
    .replace(/%\s*(?:fedtindhold|fedt|fett|fat|gras|matières grasses|mg)\b\.?/giu, "%")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function extractCertifications(name: string): { title: string; certifications: Certification[] } {
  let title = name;
  const certifications: Certification[] = [];
  for (const { id, pattern } of PATTERNS) {
    const regex = wordRegex(pattern);
    if (regex.test(title)) {
      certifications.push(id);
      title = title.replace(wordRegex(pattern), "$1");
    }
  }
  title = title.replace(/\s{2,}/g, " ").replace(/^[\s,.\-–]+|[\s,\-–]+$/g, "").trim();
  if (!title) return { title: name, certifications };
  return { title: title.charAt(0).toLocaleUpperCase("da") + title.slice(1), certifications };
}

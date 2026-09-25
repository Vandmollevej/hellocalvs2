// Ren beregning bag mængde-forslaget på /add/[id] — ingen database, så den
// kan testes direkte (amount-suggestion-math.test.mjs). Robottens globale
// tal kommer fra scripts/amount-suggestion-agent; her blandes de med
// brugerens egne seneste valg. Se docs/DECISIONS.md 2026-09-25.

export type GlobalAmount = { grams: number; confidence: number };

export type AmountEstimate = {
  grams: number;
  source: "personal" | "global" | "blend";
  confidence: number;
};

// Brugerens egen vane: vægtet median af de seneste valg (nyeste først),
// hvor hvert ældre valg vejer 30 % mindre. Median frem for gennemsnit, så
// en enkelt afvigende dag ikke flytter forslaget.
export function personalAmount(recentGrams: number[]): number | null {
  const values = recentGrams.filter((grams) => Number.isFinite(grams) && grams > 0);
  if (!values.length) return null;
  const weighted = values
    .map((grams, index) => ({ grams, weight: 0.7 ** index }))
    .sort((a, b) => a.grams - b.grams);
  const half = weighted.reduce((sum, entry) => sum + entry.weight, 0) / 2;
  let cumulative = 0;
  for (const entry of weighted) {
    cumulative += entry.weight;
    if (cumulative >= half) return entry.grams;
  }
  return weighted[weighted.length - 1].grams;
}

// Blandingen sker på log-skala: mængder er multiplikative (50 g vs. 100 g er
// samme "afstand" som 200 g vs. 400 g), så et geometrisk vægtet midtpunkt
// rammer bedre end et aritmetisk. Egen vægt = n / (n + personalWeight),
// dæmpet af hvor usikker robotten selv er.
export function combineAmounts(
  recentGrams: number[],
  global: GlobalAmount | null,
  personalWeight: number,
): AmountEstimate | null {
  const personal = personalAmount(recentGrams);
  const n = recentGrams.filter((grams) => grams > 0).length;
  if (personal === null && !global) return null;
  if (personal === null) return { grams: global!.grams, source: "global", confidence: global!.confidence };
  const personalConfidence = n / (n + personalWeight);
  if (!global) return { grams: personal, source: "personal", confidence: personalConfidence };

  const globalShare = (1 - personalConfidence) * Math.max(0.05, global.confidence);
  const personalShare = 1 - globalShare;
  const grams = Math.exp(personalShare * Math.log(personal) + globalShare * Math.log(global.grams));
  return {
    grams,
    source: "blend",
    confidence: Math.min(1, personalConfidence + (1 - personalConfidence) * global.confidence),
  };
}

// Afrund til et tal, man selv ville vælge: 1 g under 20 g, 5 g under 100 g,
// 10 g under 1 kg og 50 g derover. Varer med portioner (HelloFresh-retter)
// rundes til hele portioner.
export function roundSuggestedAmount(grams: number, servingSizeGrams?: number | null): number {
  if (servingSizeGrams && servingSizeGrams > 0) {
    return Math.max(1, Math.round(grams / servingSizeGrams)) * servingSizeGrams;
  }
  const step = grams < 20 ? 1 : grams < 100 ? 5 : grams < 1000 ? 10 : 50;
  return Math.max(step, Math.round(grams / step) * step);
}

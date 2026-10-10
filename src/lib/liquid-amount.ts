// Væsker i Opret ret (brugerens krav 2026-10-10): mængdeboksen viser rumfang
// (ml/cl) som primært tal og omregningen til gram med småt i hjørnet; et tryk
// bytter om, så gram står som primært. Mængden gemmes uændret i varens
// basisenhed (ml for drikkevarer, ellers g) — skiftet er kun visning og
// indtastning. Massefylden kommer fra omregningstabellen
// (src/lib/kitchen-conversions.ts). Native: FoodLogic.kt (liquidAmountFor).

import type { KitchenConversion } from "./kitchen-conversion-units.ts";
import type { ProductDisplayUnit } from "./product-display-unit.ts";

// Grupper i tabellen, der ikke er væsker i en ingrediensliste: tørvarer målt i
// dl og æg (et "Æg" tilføjes i stk/g, ikke i ml).
const NOT_LIQUID_GROUPS = new Set(["torvarer", "aeg"]);

export type LiquidAmount = {
  // true: mængden er gemt i ml (drikkevare); false: i g (fx generisk letmælk).
  baseIsVolume: boolean;
  volumeUnit: "ml" | "cl";
  gramsPerDl: number;
};

export type LiquidPrimary = "volume" | "grams";

// Null = ikke en væske; så vises boksen som før.
export function liquidAmountFor(displayUnit: ProductDisplayUnit, conversion: KitchenConversion | null): LiquidAmount | null {
  const liquid = conversion && !NOT_LIQUID_GROUPS.has(conversion.group) ? conversion : null;
  if (displayUnit === "ml" || displayUnit === "cl") {
    // Drikkevare uden række i tabellen: vægtes som vand.
    return { baseIsVolume: true, volumeUnit: displayUnit, gramsPerDl: liquid?.gramsPerDl ?? 100 };
  }
  return liquid ? { baseIsVolume: false, volumeUnit: "ml", gramsPerDl: liquid.gramsPerDl } : null;
}

function baseToMl(base: number, liquid: LiquidAmount) {
  return liquid.baseIsVolume ? base : (base * 100) / liquid.gramsPerDl;
}

function baseToGrams(base: number, liquid: LiquidAmount) {
  return liquid.baseIsVolume ? (base * liquid.gramsPerDl) / 100 : base;
}

// Tallet i den viste enhed (ml heltal, cl med én decimal, g heltal).
export function liquidValue(base: number, liquid: LiquidAmount, unit: LiquidPrimary): number {
  if (unit === "grams") return Math.round(baseToGrams(base, liquid));
  const ml = Math.round(baseToMl(base, liquid));
  return liquid.volumeUnit === "cl" ? ml / 10 : ml;
}

export function liquidUnitLabel(liquid: LiquidAmount, unit: LiquidPrimary): string {
  return unit === "grams" ? "g" : liquid.volumeUnit;
}

// Indtastet tal i den viste enhed → basismængde.
export function liquidBaseFromValue(value: number, liquid: LiquidAmount, unit: LiquidPrimary): number {
  if (unit === "grams") return liquid.baseIsVolume ? Math.round((value * 100) / liquid.gramsPerDl) : value;
  const ml = liquid.volumeUnit === "cl" ? Math.round(value * 10) : value;
  return liquid.baseIsVolume ? ml : Math.round((ml * liquid.gramsPerDl) / 100);
}

// Den lille omregning i hjørnet: den anden enhed end den primære.
export function liquidSecondaryText(base: number, liquid: LiquidAmount, primary: LiquidPrimary): string {
  const other: LiquidPrimary = primary === "grams" ? "volume" : "grams";
  const value = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(liquidValue(base, liquid, other));
  return `${value} ${liquidUnitLabel(liquid, other)}`;
}

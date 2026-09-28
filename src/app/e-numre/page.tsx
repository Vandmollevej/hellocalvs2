import type { Metadata } from "next";
import { listENumbers } from "@/lib/e-number-catalog";
import { ENumberDirectory, type DirectoryItem } from "./ENumberDirectory";

export const metadata: Metadata = { title: "E-numre" };

// Oversigt over alle E-numre; hvert nummer har sin egen detaljeside
// (/e-numre/E330) med beskrivelse og kilder om netop det stof.
export default function ENumbersPage() {
  const items: DirectoryItem[] = listENumbers().map((entry) => ({
    code: entry.code,
    nameDa: entry.nameDa,
    nameEn: entry.nameEn,
    category: entry.category,
    summary: entry.summary,
    euStatus: entry.euStatus,
    variants: entry.variants.map((variant) => `${variant.code} ${variant.nameDa} ${variant.nameEn}`).join(" "),
  }));
  return <ENumberDirectory items={items} />;
}

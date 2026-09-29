import type { Metadata } from "next";
import { MicronutrientDirectory } from "./MicronutrientDirectory";

export const metadata: Metadata = { title: "Vitaminer og mineraler" };

// Samlet vitamin/mineral-side: ét afsnit pr. næringsstof med eget anker
// (#vitaminc), så varesidens "Vis mere"-tabel kan linke direkte til det —
// samme mønster som /e-numre.
export default function MicronutrientsPage() {
  return <MicronutrientDirectory />;
}

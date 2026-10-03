import { prisma } from "@/lib/prisma";
import { inventoryItem } from "@/lib/ad-inventory";
import { triggerMatches } from "@/lib/ad-trigger";

// Udvælgelse af reklamer til en plads i appen (docs/DECISIONS.md 2026-10-02).
// Et spot vises kun, hvis:
//  - det har et banner,
//  - dets sponsoraftale (hvis nogen) er aktiv og inden for perioden og
//    budgettet ikke er brugt op,
//  - og dets triggere passer: har spottet en produktkategori og/eller
//    produkttype, vises det KUN når den aktuelle vare har præcis dem.
// Pladser, der ikke kan udløses (inventory.triggerable = false), ignorerer
// triggere ved udvælgelsen, men spots med triggere vises aldrig uden kontekst.

export type ServedAd = { id: string; bannerUrl: string; targetUrl: string; name: string };

export async function selectAds(
  inventoryKey: string,
  context: { category?: string | null; productType?: string | null } = {},
  now = new Date()
): Promise<ServedAd[]> {
  if (!inventoryItem(inventoryKey)) return [];
  const spots = await prisma.adLocation.findMany({
    where: { inventoryKey, bannerUrl: { not: "" } },
    include: { agreement: { include: { locations: { select: { id: true } } } } },
  });
  const served: ServedAd[] = [];
  for (const spot of spots) {
    const agreement = spot.agreement;
    if (agreement) {
      if (!agreement.active || agreement.startsAt > now || (agreement.endsAt && agreement.endsAt <= now)) continue;
      if (agreement.budgetDkk > 0 && (agreement.cpmDkk > 0 || agreement.cpcDkk > 0)) {
        const ids = agreement.locations.map((l) => l.id);
        const grouped = await prisma.adEvent.groupBy({
          by: ["type"],
          where: { locationId: { in: ids }, createdAt: { gte: agreement.startsAt } },
          _count: { _all: true },
        });
        const imp = grouped.find((g) => g.type === "IMPRESSION")?._count._all ?? 0;
        const clk = grouped.find((g) => g.type === "CLICK")?._count._all ?? 0;
        if ((imp / 1000) * agreement.cpmDkk + clk * agreement.cpcDkk >= agreement.budgetDkk) continue;
      }
    }
    if (!triggerMatches(spot, context)) continue;
    served.push({ id: spot.id, bannerUrl: spot.bannerUrl, targetUrl: spot.targetUrl, name: spot.name });
  }
  // Flere partnere kan have spots på samme plads: rotér tilfældigt, så de deler visningerne.
  return served.sort(() => Math.random() - 0.5);
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AD_INVENTORY } from "@/lib/ad-inventory";
import { getAgreementUsage } from "@/lib/partner-performance";
import { AgreementsPanel } from "@/components/admin/partner/AgreementsPanel";
import { InventoryPanel } from "@/components/admin/partner/InventoryPanel";

export const dynamic = "force-dynamic";

// Partnersiden → Sponsoraftale (docs/DECISIONS.md 2026-10-02): øverst de
// aktive aftaler med budget og forbrug, derunder alle reklamemuligheder.
export default async function PartnerAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partner = await prisma.partner.findUnique({ where: { id }, include: { locations: { orderBy: { createdAt: "asc" } } } });
  if (!partner) notFound();
  const agreements = await getAgreementUsage(id);

  return (
    <>
      <h2 className="hf-type-page-title text-hf-black">Sponsoraftale</h2>
      <AgreementsPanel partnerId={id} agreements={agreements} />
      <InventoryPanel
        partnerId={id}
        inventory={AD_INVENTORY}
        agreements={agreements.map((a) => ({ id: a.id, title: a.title }))}
        spots={partner.locations.map((l) => ({
          id: l.id,
          name: l.name,
          inventoryKey: l.inventoryKey,
          placement: l.placement,
          bannerUrl: l.bannerUrl,
          targetUrl: l.targetUrl,
          agreedImpressions: l.agreedImpressions,
          agreedClicks: l.agreedClicks,
          triggerCategory: l.triggerCategory,
          triggerProductType: l.triggerProductType,
          agreementId: l.agreementId,
        }))}
      />
    </>
  );
}

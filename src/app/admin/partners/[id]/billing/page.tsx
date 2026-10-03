import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { BillingForm } from "@/components/admin/partner/BillingForm";

export const dynamic = "force-dynamic";

// Partnersiden → Faktureringsdetaljer (docs/DECISIONS.md 2026-10-02).
export default async function PartnerBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdminUser();
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) notFound();
  return (
    <>
      <h2 className="hf-type-page-title text-hf-black">Faktureringsdetaljer</h2>
      <BillingForm
        partnerId={id}
        mode="billing"
        canEdit={admin?.adminAccessLevel === "FULL"}
        values={{
          billingName: partner.billingName,
          billingEmail: partner.billingEmail,
          billingAddress: partner.billingAddress,
          ean: partner.ean,
          billingReference: partner.billingReference,
          paymentTermsDays: String(partner.paymentTermsDays),
          paymentMethod: partner.paymentMethod,
          paymentNote: partner.paymentNote,
        }}
      />
    </>
  );
}

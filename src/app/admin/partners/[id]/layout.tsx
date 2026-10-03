import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PartnerSidebar } from "@/components/admin/partner/PartnerSidebar";

export const dynamic = "force-dynamic";

// Partnersiden (docs/DECISIONS.md 2026-10-02): venstre bjælke med
// virksomhedsoplysninger og kontaktdetaljer øverst, derunder menuen
// Sponsoraftale, Performance, Faktureringsdetaljer og Betalingsmetode.
// Adminskallen skjuler "Gå til…"-søgningen på disse sider.
export default async function PartnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { id } = await params;
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) notFound();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <PartnerSidebar
        canEdit={admin.adminAccessLevel === "FULL"}
        partner={{
          id: partner.id,
          name: partner.name,
          cvr: partner.cvr,
          addressStreet: partner.addressStreet,
          addressZip: partner.addressZip,
          addressCity: partner.addressCity,
          phone: partner.phone,
          contactName: partner.contactName,
          contactEmail: partner.contactEmail,
          contactPhone: partner.contactPhone,
          managerName: partner.managerName,
          managerTitle: partner.managerTitle,
          managerEmail: partner.managerEmail,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
    </div>
  );
}

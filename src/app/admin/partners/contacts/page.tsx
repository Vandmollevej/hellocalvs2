import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ContactsManager } from "@/components/admin/PartnerManagers";

export const dynamic = "force-dynamic";

// Admin Partnere → Kontakter (docs/DECISIONS.md 2026-09-29): kontaktpersoner
// pr. partner. Rapporter sendes kun til den partners egne aktive kontakter.
export default async function PartnerContactsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const partners = await prisma.partner.findMany({
    orderBy: { name: "asc" },
    include: { contacts: { orderBy: { name: "asc" } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Kontakter</h1>
      <p className="hf-type-body text-text-secondary">
        Kontaktpersoner pr. partner. Rapporter sendes kun til den partners egne aktive kontakter.
      </p>
      <ContactsManager
        partners={partners.map((p) => ({
          id: p.id,
          name: p.name,
          contacts: p.contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, active: c.active })),
        }))}
      />
    </div>
  );
}

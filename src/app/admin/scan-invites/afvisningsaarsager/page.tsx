import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { saveRejectionReason } from "../actions";
import { RejectionReasonRow } from "../RejectionReasonRow";

// Afvisningsårsager (docs/OPRETTELSES-APP.md): de årsager, admin kan vælge,
// når en agents indsendelse afvises. Slået fra = kan ikke vælges mere, men
// gamle afvisninger beholder deres tekst.
export default async function RejectionReasonsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const reasons = await prisma.scanRejectionReason.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin/scan-invites" className="hf-type-small text-text-secondary underline">
          ← Scan-invites
        </Link>
        <h1 className="hf-type-title text-hf-black">Afvisningsårsager</h1>
        <p className="hf-type-body text-text-secondary">
          Årsagerne du kan vælge, når du afviser en agents vare. Knappen til højre slår en årsag til eller fra.
        </p>
      </div>
      <div className="hf-panel">
        {reasons.map((reason) => (
          <RejectionReasonRow key={reason.id} id={reason.id} label={reason.label} active={reason.active} />
        ))}
        <form action={saveRejectionReason} className="flex gap-2">
          <input name="label" placeholder="Ny årsag" className="hf-type-body flex-1 rounded border border-hf-tan-dark bg-page-bg px-2 py-1" />
          <button type="submit" className="hf-btn-secondary hf-btn--compact w-fit">
            Tilføj
          </button>
        </form>
      </div>
    </div>
  );
}

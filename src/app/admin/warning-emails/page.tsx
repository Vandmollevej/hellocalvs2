import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { getAdminWarnings } from "@/lib/admin-warnings";
import { setWarningEmails } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminWarningEmailsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const me = await prisma.user.findUnique({ where: { id: admin.id }, select: { adminWarningEmails: true, email: true } });
  const warnings = await getAdminWarnings().catch(() => []);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Mine advarselsmails</h1>
      <p className="hf-type-body text-text-secondary">
        Få en mail på {me?.email}, når Admin viser en advarsel: OpenAI-betaling eller -nøgle, integrationer der ikke virker,
        og kørsler der fejler eller står stille. Samme advarsel mailes højst én gang i døgnet. Indstillingen gælder kun dig.
      </p>
      <form action={setWarningEmails} className="flex items-center gap-3">
        <label className="hf-type-body flex items-center gap-2 text-hf-black">
          <input type="checkbox" name="enabled" defaultChecked={me?.adminWarningEmails ?? true} />
          Send mig advarselsmails
        </label>
        <button type="submit" className="hf-btn hf-btn-primary">Gem</button>
      </form>
      <p className="hf-type-body text-text-secondary">
        Aktive advarsler lige nu: {warnings.length === 0 ? "ingen" : warnings.length}
      </p>
    </div>
  );
}

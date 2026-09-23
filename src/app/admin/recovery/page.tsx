import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { RecoveryCaseList } from "@/components/admin/RecoveryCaseList";

export default async function AdminRecoveryPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Gendannelse</h1>
      <p className="text-sm text-text-secondary">
        Godkend kun, når du har talt med brugeren, og e-mailen passer til sagen. Du kan ikke se brugerens data.
      </p>
      <RecoveryCaseList />
    </div>
  );
}

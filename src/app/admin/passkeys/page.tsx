import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { PasskeyManager } from "@/components/admin/PasskeyManager";

export default async function AdminPasskeysPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Passkeys</h1>
      <PasskeyManager />
    </div>
  );
}

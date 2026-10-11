import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { PasskeyManager } from "@/components/admin/PasskeyManager";

export default async function AdminPasskeysPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="hf-admin-page">
      <h1 className="hf-type-title text-hf-black">Passkeys</h1>
      <PasskeyManager />
    </div>
  );
}

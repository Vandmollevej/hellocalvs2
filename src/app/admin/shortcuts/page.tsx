import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { ShortcutsList } from "@/components/admin/ShortcutsList";

// Admin → Indstillinger → Genveje (docs/AUTOMATION.md): tastaturgenvej til
// hvert menupunkt, læst fra menuen i AdminShell.
export const dynamic = "force-dynamic";

export default async function AdminShortcutsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return <ShortcutsList locale={admin.locale} canManageAdmins={admin.adminAccessLevel === "FULL"} />;
}

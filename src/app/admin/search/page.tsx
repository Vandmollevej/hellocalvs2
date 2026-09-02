import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { AdminProductSearch } from "@/components/admin/AdminProductSearch";

export default async function AdminSearchPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Søg</h1>
      <p className="text-sm text-text-secondary">Søg i den godkendte database og ret eksisterende produkter.</p>
      <AdminProductSearch />
    </div>
  );
}

import type { Metadata } from "next";
import { requireAdminUser } from "@/lib/require-admin";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: "HELLO CAL — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminUser();

  return (
    <div className="min-h-dvh bg-page-bg text-text-primary">
      {admin && <AdminNav email={admin.email} />}
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

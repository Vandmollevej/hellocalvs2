import type { Metadata } from "next";
import { requireAdminUser } from "@/lib/require-admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { hasOpenUncertainties } from "@/lib/uncertainties";

export const metadata: Metadata = {
  title: "HELLO CAL — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminUser();
  const uncertaintiesDot = admin ? await hasOpenUncertainties().catch(() => false) : false;

  if (!admin) {
    // Login/opsætning/bekræftelse: ingen skal, kun formularen.
    return (
      <div className="h-dvh overflow-y-auto bg-page-bg text-hf-black">
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-8">{children}</main>
      </div>
    );
  }

  return (
    <AdminShell email={admin.email} locale={admin.locale} hasOpenUncertainties={uncertaintiesDot}>
      {children}
    </AdminShell>
  );
}

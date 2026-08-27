import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

export default async function AdminDashboardPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const [pendingProducts, pendingImages] = await Promise.all([
    prisma.product.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { imageStatus: "PENDING" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Oversigt</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/produkter"
          className="rounded-lg border border-border-strong bg-surface-2 p-5 hover:border-hf-green"
        >
          <p className="text-3xl font-semibold text-hf-green-dark">{pendingProducts}</p>
          <p className="mt-1 text-sm text-text-secondary">Nye produkter afventer godkendelse</p>
        </Link>
        <Link
          href="/admin/billeder"
          className="rounded-lg border border-border-strong bg-surface-2 p-5 hover:border-hf-green"
        >
          <p className="text-3xl font-semibold text-hf-green-dark">{pendingImages}</p>
          <p className="mt-1 text-sm text-text-secondary">Billedforslag afventer godkendelse</p>
        </Link>
      </div>
    </div>
  );
}

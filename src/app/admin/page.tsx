import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

export default async function AdminDashboardPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const [pendingProducts, pendingImages] = await Promise.all([
    prisma.product.count({ where: { status: "PENDING", privateOwnerId: null } }),
    prisma.product.count({ where: { imageStatus: "PENDING" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Oversigt</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/products"
          className="rounded-lg border border-hf-tan-dark bg-hf-white p-4 hover:border-hf-green"
        >
          <p className="hf-type-hero text-hf-green-dark">{pendingProducts}</p>
          <p className="hf-type-body mt-1 text-text-secondary">Nye produkter afventer godkendelse</p>
        </Link>
        <Link
          href="/admin/images"
          className="rounded-lg border border-hf-tan-dark bg-hf-white p-4 hover:border-hf-green"
        >
          <p className="hf-type-hero text-hf-green-dark">{pendingImages}</p>
          <p className="hf-type-body mt-1 text-text-secondary">Billedforslag afventer godkendelse</p>
        </Link>
      </div>
    </div>
  );
}

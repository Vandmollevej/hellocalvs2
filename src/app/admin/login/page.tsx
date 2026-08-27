import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default async function AdminLoginPage() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN", passwordHash: { not: null } } });
  if (!existingAdmin) redirect("/admin/setup");

  return <AdminLoginForm />;
}

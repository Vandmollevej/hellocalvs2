import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminSetupForm } from "@/components/admin/AdminSetupForm";

export default async function AdminSetupPage() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN", passwordHash: { not: null } } });
  if (existingAdmin) redirect("/admin/login");

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold text-text-primary">Opret administrator</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Dette kører kun én gang. Vælg en email og et password, og scan derefter
        QR-koden med en authenticator-app (fx Google Authenticator eller Authy).
      </p>
      <AdminSetupForm />
    </div>
  );
}

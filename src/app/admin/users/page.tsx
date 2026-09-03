import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { AdminUserRow } from "@/components/admin/AdminUserRow";
import { t } from "@/lib/admin-i18n";

// Admin "Brugere" (docs/DECISIONS.md 2026-09-02): oversigt over registranter
// med betalingsstatus, points, nyhedsbrevs-tilmeldinger, "log ind som
// bruger" (impersonation, revisionsspor i AdminAuditLog) og "ret til at
// blive glemt" (GDPR-anonymisering, src/lib/gdpr.ts).
export default async function AdminUsersPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const users = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
    include: { subscription: true },
  });

  const balances = await prisma.pointsTransaction.groupBy({
    by: ["userId"],
    _sum: { amount: true },
  });
  const balanceByUser = new Map(balances.map((b) => [b.userId, b._sum.amount ?? 0]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{t(admin.locale, "users_title")}</h1>
        <p className="text-sm text-text-secondary">
          {users.length} registranter. Klik ikonet for at logge ind som en bruger (åbner en ny
          fane) eller anonymisere kontoen.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-strong text-xs uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-3">{t(admin.locale, "users_col_user")}</th>
              <th className="py-2 pr-3">{t(admin.locale, "users_col_payment")}</th>
              <th className="py-2 pr-3">{t(admin.locale, "users_col_points")}</th>
              <th className="py-2 pr-3">{t(admin.locale, "users_col_newsletters")}</th>
              <th className="py-2 pr-3">{t(admin.locale, "users_col_created")}</th>
              <th className="py-2">{t(admin.locale, "users_col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <AdminUserRow
                key={user.id}
                user={{
                  id: user.id,
                  displayName: user.displayName,
                  email: user.email,
                  createdAt: user.createdAt.toISOString(),
                  pointsBalance: balanceByUser.get(user.id) ?? 0,
                  subscriptionStatus: user.subscription?.status ?? "INACTIVE",
                  wantsUpdateNewsEmails: user.wantsUpdateNewsEmails,
                  wantsAdviceEmails: user.wantsAdviceEmails,
                  wantsPartnerOffersEmails: user.wantsPartnerOffersEmails,
                  forgottenAt: user.forgottenAt?.toISOString() ?? null,
                }}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="py-4 text-sm text-text-secondary">Ingen brugere endnu.</p>}
      </div>
    </div>
  );
}

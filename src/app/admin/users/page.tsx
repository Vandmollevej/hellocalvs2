import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { AdminUserRow } from "@/components/admin/AdminUserRow";
import { t } from "@/lib/admin-i18n";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";
import { broadcastAudience } from "@/lib/admin-broadcast";

// Admin "Brugere" (docs/DECISIONS.md 2026-09-02): oversigt over registranter
// med betalingsstatus, points, nyhedsbrevs-tilmeldinger og "ret til at
// blive glemt" (GDPR-anonymisering, src/lib/gdpr.ts). "Log ind som bruger"
// er fjernet 2026-09-23 (docs/PRIVACY.md).
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  // ?show=blocked viser kun spærrede konti (dyrefoder-spærringen, docs/DECISIONS.md 2026-10-07).
  const { show } = await searchParams;
  const showBlocked = show === "blocked";

  const audience = await broadcastAudience();

  const users = await prisma.user.findMany({
    where: { role: "USER", ...(showBlocked ? { blockedAt: { not: null } } : {}) },
    orderBy: showBlocked ? { blockedAt: "desc" } : { createdAt: "desc" },
    include: { subscription: true },
  });
  const [totalUsers, blockedUsers] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", blockedAt: { not: null }, forgottenAt: null } }),
  ]);

  const balances = await prisma.pointsTransaction.groupBy({
    by: ["userId"],
    _sum: { amount: true },
  });
  const balanceByUser = new Map(balances.map((b) => [b.userId, b._sum.amount ?? 0]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">{t(admin.locale, "users_title")}</h1>
        <p className="hf-type-body text-text-secondary">
          {users.length} registranter. Mønt-ikonet tildeler points; det røde ikon anonymiserer kontoen.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className={`hf-type-small rounded-full px-3 py-1 ${!showBlocked ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"}`}
        >
          Alle ({totalUsers})
        </Link>
        <Link
          href="/admin/users?show=blocked"
          className={`hf-type-small rounded-full px-3 py-1 ${
            showBlocked
              ? "bg-hf-red-dark text-hf-white"
              : blockedUsers > 0
                ? "bg-hf-warning text-hf-warning-text"
                : "bg-hf-tan text-text-secondary"
          }`}
        >
          Spærrede ({blockedUsers})
        </Link>
      </div>

      {admin.adminAccessLevel === "FULL" && !showBlocked && <BroadcastPanel emailUsers={audience.emailUsers} pushUsers={audience.pushUsers} />}

      <div className="overflow-x-auto">
        <table className="hf-type-body w-full text-left">
          <thead>
            <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
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
                  // Navn og e-mail sendes aldrig til admin-siden (brugerdata er fortrolige).
                  displayName: `Bruger ${user.id.slice(-6)}`,
                  createdAt: user.createdAt.toISOString(),
                  pointsBalance: balanceByUser.get(user.id) ?? 0,
                  subscriptionStatus: user.subscription?.status ?? "INACTIVE",
                  wantsUpdateNewsEmails: user.wantsUpdateNewsEmails,
                  wantsAdviceEmails: user.wantsAdviceEmails,
                  wantsPartnerOffersEmails: user.wantsPartnerOffersEmails,
                  forgottenAt: user.forgottenAt?.toISOString() ?? null,
                  closedAt: user.closedAt?.toISOString() ?? null,
                  blockedAt: user.blockedAt?.toISOString() ?? null,
                  blockedReason: user.blockedReason,
                }}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="hf-type-body py-4 text-text-secondary">
            {showBlocked ? "Ingen spærrede konti." : "Ingen brugere endnu."}
          </p>
        )}
      </div>
    </div>
  );
}

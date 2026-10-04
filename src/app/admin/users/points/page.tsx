import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ADMIN_GRANT_MAX_POINTS, canGrantAdminPoints, nextAdminGrantAllowedAt } from "@/lib/admin-points-grant-rules";
import { AdminGrantPointsForm } from "@/components/admin/AdminGrantPointsForm";
import { t } from "@/lib/admin-i18n";

// Admin → Brugere → Tildel points (docs/DECISIONS.md 2026-10-03): giv en
// bruger points, fx som kompensation. Højst 300 points (én gratis måned) pr.
// tildeling og højst én gang pr. måned pr. bruger.
export const dynamic = "force-dynamic";

const SEARCH_LIMIT = 25;
const HISTORY_LIMIT = 50;
const date = (value: Date) => value.toLocaleDateString("da-DK");

export default async function AdminGrantPointsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; user?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const canAct = admin.adminAccessLevel === "FULL";
  const eligible: Prisma.UserWhereInput = { role: "USER", forgottenAt: null, closedAt: null };

  const [matches, selected, history] = await Promise.all([
    q
      ? prisma.user.findMany({
          where: {
            ...eligible,
            OR: [
              // Navn og e-mail er krypteret i databasen (docs/DECISIONS.md
              // 2026-10-04): soeg paa praecis e-mail eller bruger-id.
              { email: q.toLowerCase() },
              { id: q },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: SEARCH_LIMIT,
          select: { id: true, displayName: true, email: true },
        })
      : Promise.resolve([]),
    params.user
      ? prisma.user.findFirst({ where: { ...eligible, id: params.user }, select: { id: true, displayName: true, email: true } })
      : Promise.resolve(null),
    prisma.pointsTransaction.findMany({
      where: { reason: "ADMIN_GRANT" },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { id: true, amount: true, note: true, grantedById: true, createdAt: true, user: { select: { displayName: true, email: true } } },
    }),
  ]);

  const [balance, lastGrant, granters] = await Promise.all([
    selected
      ? prisma.pointsTransaction.aggregate({ where: { userId: selected.id }, _sum: { amount: true } })
      : Promise.resolve(null),
    selected
      ? prisma.pointsTransaction.findFirst({
          where: { userId: selected.id, reason: "ADMIN_GRANT" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, amount: true },
        })
      : Promise.resolve(null),
    prisma.user.findMany({
      where: { id: { in: [...new Set(history.map((row) => row.grantedById).filter((id): id is string => Boolean(id)))] } },
      select: { id: true, email: true },
    }),
  ]);
  const granterEmail = new Map(granters.map((row) => [row.id, row.email]));
  const allowed = canGrantAdminPoints(lastGrant?.createdAt ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">{t(admin.locale, "nav_grant_points")}</h1>
        <p className="hf-type-body text-text-secondary">
          Giv en bruger points, fx som kompensation. Højst {ADMIN_GRANT_MAX_POINTS} points (én gratis måned) ad gangen og
          højst én gang om måneden pr. bruger. Brugeren ser tildelingen som &quot;Tildelt af HELLO CAL&quot; i sin
          points-historik; begrundelsen ses kun her.
        </p>
      </div>

      <form action="/admin/users/points" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Søg på præcis e-mail eller bruger-id"
          className="hf-type-body hf-field min-w-0 flex-1 rounded-md border border-hf-tan-dark bg-hf-white px-3"
        />
        <button type="submit" className="hf-type-body rounded-md border border-hf-tan-dark px-4 py-2">
          Søg
        </button>
      </form>

      {q && (
        <div className="flex flex-col divide-y divide-hf-tan-dark rounded-lg border border-hf-tan-dark bg-hf-white">
          {matches.length === 0 && <p className="hf-type-body p-3 text-text-secondary">Ingen brugere matcher &quot;{q}&quot;.</p>}
          {matches.map((user) => (
            <Link
              key={user.id}
              href={`/admin/users/points?${new URLSearchParams({ q, user: user.id })}`}
              className={`flex flex-col p-3 hover:bg-hf-tan ${selected?.id === user.id ? "bg-hf-tan" : ""}`}
            >
              <span className="hf-type-body hf-type-strong text-hf-black">{user.displayName}</span>
              <span className="hf-type-small text-text-muted">{user.email}</span>
            </Link>
          ))}
        </div>
      )}

      {params.user && !selected && (
        <p className="hf-type-body text-hf-red-dark">Brugeren findes ikke, eller kontoen er lukket.</p>
      )}

      {selected && (
        <div className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <div>
            <p className="hf-type-body hf-type-strong text-hf-black">{selected.displayName}</p>
            <p className="hf-type-small text-text-muted">{selected.email}</p>
            <p className="hf-type-small text-text-secondary">
              Saldo: {balance?._sum.amount ?? 0} points ·{" "}
              {lastGrant ? `senest tildelt ${lastGrant.amount} points ${date(lastGrant.createdAt)}` : "aldrig tildelt points af admin"}
            </p>
          </div>
          {!allowed && lastGrant ? (
            <p className="hf-type-body text-text-secondary">
              Brugeren har fået points inden for den seneste måned. Næste mulige tildeling:{" "}
              {date(nextAdminGrantAllowedAt(lastGrant.createdAt))}.
            </p>
          ) : canAct ? (
            <AdminGrantPointsForm userId={selected.id} displayName={selected.displayName} />
          ) : (
            <p className="hf-type-body text-text-secondary">Kræver fuld administratoradgang.</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="hf-type-strong text-hf-black">Seneste tildelinger</h2>
        <div className="overflow-x-auto">
          <table className="hf-type-body w-full text-left">
            <thead>
              <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-3">Dato</th>
                <th className="py-2 pr-3">Bruger</th>
                <th className="py-2 pr-3">Points</th>
                <th className="py-2 pr-3">Begrundelse</th>
                <th className="py-2">Tildelt af</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b border-hf-tan-dark align-top">
                  <td className="hf-type-small py-2 pr-3 text-text-muted">{date(row.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <p className="hf-type-strong text-hf-black">{row.user.displayName}</p>
                    <p className="hf-type-small text-text-muted">{row.user.email}</p>
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">+{row.amount}</td>
                  <td className="hf-type-small py-2 pr-3 text-text-secondary">{row.note ?? "—"}</td>
                  <td className="hf-type-small py-2 text-text-muted">
                    {(row.grantedById && granterEmail.get(row.grantedById)) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && <p className="hf-type-body py-4 text-text-secondary">Ingen tildelinger endnu.</p>}
        </div>
      </div>
    </div>
  );
}

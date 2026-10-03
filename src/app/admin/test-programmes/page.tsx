import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { INTEGRATION_CATALOG } from "@/lib/integrations";
import { INTEGRATION_TESTER_POINTS } from "@/lib/points-constants";
import { TesterActions } from "@/components/admin/TesterActions";
import { t } from "@/lib/admin-i18n";

// Admin → Brugere → Test-programmes (docs/DECISIONS.md 2026-10-02): én
// testperson-plads pr. integration. Godkend, når forbindelsen har hentet
// data — først da gives points. Afvis gør pladsen ledig igen.
export default async function AdminTestProgrammesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const testers = await prisma.integrationTester.findMany({
    select: {
      id: true,
      provider: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
          integrations: { select: { provider: true, status: true, connectedAt: true, lastSyncedAt: true } },
        },
      },
    },
  });
  const byProvider = new Map(testers.map((tester) => [tester.provider, tester]));
  const canAct = admin.adminAccessLevel === "FULL";
  const date = (value: Date | null) => (value ? value.toLocaleDateString("da-DK") : "—");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">{t(admin.locale, "nav_test_programmes")}</h1>
      <p className="hf-type-body text-text-secondary">
        Den første bruger, der tilmelder sig på en integrations side, får pladsen. Godkend, når appen er aktiveret
        og har hentet data — det giver {INTEGRATION_TESTER_POINTS} points. Afvis gør pladsen ledig igen.
      </p>
      <div className="flex flex-col gap-3">
        {INTEGRATION_CATALOG.map((meta) => {
          const tester = byProvider.get(meta.provider);
          const connection = tester?.user.integrations.find((row) => row.provider === meta.provider);
          return (
            <div key={meta.provider} className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {meta.icon ? <img src={meta.icon} alt="" className="h-10 w-10 shrink-0 rounded-md" /> : <span aria-hidden className="h-10 w-10 shrink-0 rounded-md bg-hf-tan" />}
                  <div className="min-w-0">
                    <p className="hf-type-body hf-type-strong text-hf-black">{meta.label}</p>
                    {!tester ? (
                      <p className="hf-type-small text-text-muted">Ledig — ingen testperson endnu</p>
                    ) : (
                      <>
                        <p className="hf-type-small text-text-muted">
                          {tester.user.displayName} · {tester.user.email} · tilmeldt {date(tester.createdAt)}
                        </p>
                        <p className="hf-type-small text-text-muted">
                          Forbindelse:{" "}
                          {connection && connection.status !== "DISCONNECTED"
                            ? `${connection.status === "ERROR" ? "fejl" : "aktiveret"} ${date(connection.connectedAt)} · senest hentet ${date(connection.lastSyncedAt)}`
                            : "ikke aktiveret"}
                        </p>
                        {tester.status === "APPROVED" && (
                          <p className="hf-type-small hf-type-strong text-hf-green-dark">
                            Godkendt {date(tester.approvedAt)} · {INTEGRATION_TESTER_POINTS} points givet
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {tester?.status === "PENDING" && canAct && <TesterActions id={tester.id} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

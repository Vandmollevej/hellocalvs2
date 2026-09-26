import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import { SupportRequestStatusButton } from "@/components/admin/SupportRequestStatusButton";
import { instantToDateKey, isSupportGrantActive } from "@/lib/support-access";
import { SUPPORT_PERMISSION_KEYS, readSupportPermissions } from "@/lib/support-permissions";
import da from "@/i18n/locales/da.json";

const CATEGORY_LABELS: Record<string, string> = {
  ACCOUNT: "Konto og login",
  DATA: "Mine data",
  PRODUCTS: "Produkter og søgning",
  PAYMENT: "Abonnement og betaling",
  BUG: "Fejl i appen",
  OTHER: "Andet",
};

const PERMISSION_LABELS = da.settings.support.permissions as Record<string, string>;

// Admin "Support" (docs/DECISIONS.md 2026-09-23): henvendelser fra "Kontakt
// os" med den tilladelse, brugeren havde aktiv, da de skrev. Kun kategorier
// og periode vises — selve dataene læses aldrig fra serveren her
// (docs/PRIVACY.md); de kommer som en krypteret pakke fra brugerens enhed.
export default async function AdminSupportPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const requests = await prisma.supportRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { supportGrant: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">{t(admin.locale, "support_title")}</h1>
        <p className="hf-type-body text-text-secondary">
          {requests.filter((r) => r.status === "OPEN").length} åbne. Tilladelsen viser, hvilke datatyper brugeren
          har givet Support lov til at se, og i hvilken periode.
        </p>
      </div>

      {requests.length === 0 && <p className="hf-type-body py-4 text-text-secondary">Ingen henvendelser endnu.</p>}

      <div className="flex flex-col gap-4">
        {requests.map((request) => {
          const grant = request.supportGrant;
          const permissions = grant ? readSupportPermissions(grant.permissions) : null;
          const allowed = permissions ? SUPPORT_PERMISSION_KEYS.filter((key) => permissions[key]) : [];
          const grantActive = grant ? isSupportGrantActive(grant) : false;
          return (
            <div key={request.id} className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="hf-type-strong text-hf-black">{request.subject}</p>
                  <p className="hf-type-small text-text-muted">
                    Sag {request.id.slice(-8).toUpperCase()} · {CATEGORY_LABELS[request.category]} ·{" "}
                    {request.createdAt.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`hf-type-small rounded-full px-2 py-0.5 ${
                      request.status === "OPEN" ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"
                    }`}
                  >
                    {request.status === "OPEN" ? "Åben" : "Løst"}
                  </span>
                  <SupportRequestStatusButton id={request.id} status={request.status} />
                </div>
              </div>
              <p className="hf-type-body mt-4 whitespace-pre-wrap text-hf-black">{request.message}</p>
              <div className="hf-type-small mt-4 border-t border-hf-tan-dark pt-2 text-text-secondary">
                {!grant && "Ingen dataadgang givet."}
                {grant && (
                  <>
                    <span className={grantActive ? "text-hf-green-dark" : "text-text-muted"}>
                      {grant.revokedAt ? "Tilbagekaldt" : grantActive ? "Aktiv" : "Ikke aktiv"}
                    </span>{" "}
                    · {instantToDateKey(grant.validFrom)} – {instantToDateKey(grant.validUntil)} ·{" "}
                    {allowed.length ? allowed.map((key) => PERMISSION_LABELS[key] ?? key).join(", ") : "Ingen datatyper"}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

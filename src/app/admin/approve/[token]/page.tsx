import { prisma } from "@/lib/prisma";
import { TokenApprovalActions } from "@/components/admin/TokenApprovalActions";

// Login-frit admin-godkendelseslink (docs/DECISIONS.md 2026-09-02) — se
// middleware.ts (PUBLIC_ADMIN_PATHS) og src/app/api/admin/approve/[token]/route.ts.
// Ingen requireAdminUser() her med vilje: adgangen kommer fra selve tokenet.
export default async function TokenApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const product = await prisma.product.findUnique({ where: { approvalToken: token }, include: { brand: true } });
  const bugReport = product
    ? null
    : await prisma.bugReport.findUnique({ where: { approvalToken: token }, include: { user: true } });

  if (!product && !bugReport) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="hf-type-body text-text-secondary">
          Linket er ikke gyldigt eller er allerede brugt.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      {product ? (
        <>
          <h1 className="hf-type-title text-hf-black">{product.name}</h1>
          <p className="hf-type-body mt-1 text-text-secondary">
            {[product.brand?.name, `${Math.round(product.kcalPer100g)} kcal / 100 g`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="hf-type-small mt-1 text-text-muted">
            Indsendt: {product.createdAt.toLocaleDateString("da-DK")}
          </p>
        </>
      ) : (
        bugReport && (
          <>
            <h1 className="hf-type-title text-hf-black">Fejlrapport</h1>
            <p className="hf-type-body mt-1 text-text-secondary">
              {bugReport.user
                ? `Fra ${bugReport.user.displayName} (${bugReport.user.email})`
                : "AI-genereret (ingen bruger)"}
            </p>
            <p className="hf-type-body mt-4 whitespace-pre-wrap text-hf-black">{bugReport.description}</p>
          </>
        )
      )}

      <div className="mt-8">
        <TokenApprovalActions token={token} />
      </div>
    </div>
  );
}

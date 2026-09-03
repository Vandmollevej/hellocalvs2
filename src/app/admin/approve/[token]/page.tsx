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
        <p className="text-sm text-text-secondary">
          Linket er ikke gyldigt eller er allerede brugt.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      {product ? (
        <>
          <h1 className="text-lg font-semibold text-text-primary">{product.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {[product.brand?.name, `${Math.round(product.kcalPer100g)} kcal / 100 g`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Indsendt: {product.createdAt.toLocaleDateString("da-DK")}
          </p>
        </>
      ) : (
        bugReport && (
          <>
            <h1 className="text-lg font-semibold text-text-primary">Fejlrapport</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Fra {bugReport.user.displayName} ({bugReport.user.email})
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-text-primary">{bugReport.description}</p>
          </>
        )
      )}

      <div className="mt-6">
        <TokenApprovalActions token={token} />
      </div>
    </div>
  );
}

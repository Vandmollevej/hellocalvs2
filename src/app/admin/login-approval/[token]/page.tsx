import { prisma } from "@/lib/prisma";
import { formatPlace, hashToken } from "@/lib/admin-access";
import { LoginApprovalActions } from "@/components/admin/LoginApprovalActions";

// Login-frit link fra godkendelses-mailen (ny enhed). Se middleware.ts.
export default async function LoginApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const approval = await prisma.adminLoginApproval.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!approval || approval.consumedAt || approval.expiresAt < new Date()) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="hf-type-body text-text-secondary">Linket er ikke gyldigt, er udløbet eller allerede brugt.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="hf-type-title text-hf-black">Godkend login</h1>
      <p className="hf-type-body mt-2 text-text-secondary">Der er forsøgt at logge ind på Hello Cal Admin fra:</p>
      <dl className="hf-type-body mt-4 flex flex-col gap-1 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <div>
          <dt className="hf-type-small text-text-muted">Udstyr</dt>
          <dd>{approval.deviceLabel}</dd>
        </div>
        <div className="mt-2">
          <dt className="hf-type-small text-text-muted">Sted</dt>
          <dd>{formatPlace(approval.country, approval.city)}</dd>
        </div>
        <div className="mt-2">
          <dt className="hf-type-small text-text-muted">IP-adresse</dt>
          <dd>{approval.ip ?? "—"}</dd>
        </div>
        <div className="mt-2">
          <dt className="hf-type-small text-text-muted">Tidspunkt</dt>
          <dd>{approval.createdAt.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <LoginApprovalActions token={token} />
      </div>
    </div>
  );
}

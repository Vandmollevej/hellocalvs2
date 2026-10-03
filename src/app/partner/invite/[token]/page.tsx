import { findUsablePartnerInvite } from "@/lib/partner/invites";
import { PartnerInviteForm } from "@/components/partner/PartnerInviteForm";

export const dynamic = "force-dynamic";

// Login-frit invitationslink (middleware.ts PUBLIC_PARTNER_PATHS). Adgangen
// kommer fra det uigættelige engangstoken, udstedt af en administrator.
export default async function PartnerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findUsablePartnerInvite(token);

  if (!invite) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="hf-type-title mb-2 text-hf-black">Linket virker ikke længere</h1>
        <p className="hf-type-body text-text-secondary">
          Invitationen er udløbet eller allerede brugt. Bed Hello Cal om en ny invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="hf-type-title mb-1 text-hf-black">Velkommen, {invite.name}</h1>
      <p className="hf-type-body mb-8 text-text-secondary">
        Du er inviteret til Hello Cals partnerportal for <strong>{invite.partner.name}</strong> ({invite.email}). Vælg en
        adgangskode for at komme i gang.
      </p>
      <PartnerInviteForm token={token} />
    </div>
  );
}

import { findUsableAdminInvite, LEVEL_LABEL } from "@/lib/admin-invites";
import { AdminInviteForm } from "@/components/admin/AdminInviteForm";

// Login-frit tilmeldingslink til admin-panelet (middleware.ts PUBLIC_ADMIN_PATHS).
// Adgangen kommer fra det uigættelige token; linket gælder 24 timer.
export default async function AdminInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findUsableAdminInvite(token);

  if (!invite) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="hf-type-body text-text-secondary">
          Invitationen er udløbet eller allerede brugt. Bed om en ny invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      <h1 className="hf-type-title mb-1 text-hf-black">Velkommen, {invite.name}</h1>
      <p className="hf-type-body mb-8 text-text-secondary">
        Du er inviteret til Hello Cal Admin som {LEVEL_LABEL[invite.accessLevel].toLowerCase()} ({invite.email}). Vælg
        en adgangskode, og scan derefter QR-koden med en authenticator-app (fx Google Authenticator eller Authy).
        2-faktor er obligatorisk ved hvert login.
      </p>
      <AdminInviteForm token={token} />
    </div>
  );
}

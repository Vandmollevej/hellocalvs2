import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import {
  PARTNER_INVITE_LINK_COOKIE,
  PARTNER_INVITE_TTL_HOURS,
  PARTNER_USER_STATUS_LABEL,
  partnerUserStatus,
} from "@/lib/partner/invites";
import {
  deletePartnerUser,
  invitePartnerUser,
  resendPartnerUserInvite,
  revokePartnerUserInvite,
  setPartnerUserDisabled,
  signOutPartnerUserEverywhere,
} from "./actions";

export const dynamic = "force-dynamic";

// Admin Partnere → B2B-brugere (docs/DECISIONS.md 2026-10-02): login til
// partnerportalen (/partner) for en partners egne folk. Kun en administrator
// med fuld adgang kan invitere; læseadgang ser kun listen.

function fmt(date: Date | null | undefined) {
  return date ? date.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" }) : "—";
}

const inputClass = "rounded border border-hf-tan-dark bg-page-bg px-3 py-2";
const smallButton = "hf-type-small rounded border border-hf-tan-dark px-2.5 py-1 hover:bg-hf-tan";

export default async function PartnerUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const me = await requireAdminUser();
  if (!me) redirect("/admin/login");
  const isFull = me.adminAccessLevel === "FULL";
  const { error, invite: inviteState } = await searchParams;
  const store = await cookies();
  const inviteLink = inviteState && isFull ? (store.get(PARTNER_INVITE_LINK_COOKIE)?.value ?? null) : null;

  const partners = await prisma.partner.findMany({
    orderBy: { name: "asc" },
    include: {
      users: { orderBy: { createdAt: "asc" }, include: { invitedBy: { select: { displayName: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">B2B-brugere</h1>
        <p className="hf-type-body text-text-secondary">
          Login til partnerportalen (/partner), hvor partnerens egne folk ser visninger og klik på deres placeringer og de
          rapporter, vi har sendt. B2B-brugere kan kun oprettes her af en administrator — der findes ingen offentlig
          tilmelding.
        </p>
      </div>

      {isFull ? (
        <section className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <h2 className="hf-type-body hf-type-strong">Inviter ny B2B-bruger</h2>
          {partners.length === 0 ? (
            <p className="hf-type-body text-text-secondary">Opret først en partner under Kontakter.</p>
          ) : (
            <form action={invitePartnerUser} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="hf-type-body flex flex-col gap-1">
                Partner
                <select name="partnerId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Vælg partner
                  </option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hf-type-body flex flex-1 flex-col gap-1">
                Navn
                <input name="name" required className={inputClass} />
              </label>
              <label className="hf-type-body flex flex-1 flex-col gap-1">
                E-mail
                <input name="email" type="email" required className={inputClass} />
              </label>
              <button type="submit" className="hf-btn-primary px-4 py-2">
                Send invitation
              </button>
            </form>
          )}
          <p className="hf-type-small text-text-secondary">
            Invitationen gælder i {PARTNER_INVITE_TTL_HOURS} timer og kan kun bruges én gang. Modtageren vælger selv adgangskode.
          </p>
          {error === "invalid" && <p className="hf-type-body text-[var(--hf-color-danger)]">Vælg partner, og udfyld navn og en gyldig e-mail.</p>}
          {error === "exists" && <p className="hf-type-body text-[var(--hf-color-danger)]">Der findes allerede en B2B-bruger med den e-mail.</p>}
          {error === "partner" && <p className="hf-type-body text-[var(--hf-color-danger)]">Partneren findes ikke længere.</p>}
          {inviteState === "sent" && <p className="hf-type-body text-hf-green-dark">Invitationen er sendt på mail.</p>}
          {inviteState === "manual" && (
            <p className="hf-type-body text-[var(--hf-color-danger)]">
              Mailen kunne ikke sendes. Giv modtageren dette link (gælder {PARTNER_INVITE_TTL_HOURS} timer):
            </p>
          )}
          {inviteLink && (
            <input readOnly value={inviteLink} className="hf-type-small w-full rounded border border-hf-tan-dark bg-page-bg px-3 py-2" />
          )}
        </section>
      ) : (
        <p className="hf-type-body rounded-lg border border-hf-tan-dark bg-hf-white p-4 text-text-secondary">
          Kun administratorer med fuld adgang kan oprette og ændre B2B-brugere.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="hf-type-body hf-type-strong">Brugere pr. partner</h2>
        {partners.length === 0 && <p className="hf-type-body text-text-secondary">Ingen partnere endnu.</p>}
        {partners.map((partner) => (
          <div key={partner.id} className="flex flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
            <p className="hf-type-strong text-hf-black">{partner.name}</p>
            {partner.users.length === 0 ? (
              <p className="hf-type-small text-text-muted">Ingen B2B-brugere.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="hf-type-body w-full text-left">
                  <thead>
                    <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
                      <th className="py-2 pr-3">Bruger</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Inviteret af</th>
                      <th className="py-2 pr-3">Sidst logget ind</th>
                      {isFull && <th className="py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {partner.users.map((user) => {
                      const status = partnerUserStatus(user);
                      const pending = status === "PENDING" || status === "EXPIRED";
                      return (
                        <tr key={user.id} className="border-b border-border-strong/50">
                          <td className="py-2 pr-3">
                            <div className="hf-type-strong">{user.name}</div>
                            <div className="hf-type-small text-text-secondary">{user.email}</div>
                          </td>
                          <td className={`py-2 pr-3 ${status === "ACTIVE" ? "" : "text-hf-red-dark"}`}>
                            {PARTNER_USER_STATUS_LABEL[status]}
                            {status === "PENDING" && (
                              <div className="hf-type-small text-text-secondary">udløber {fmt(user.inviteExpiresAt)}</div>
                            )}
                          </td>
                          <td className="py-2 pr-3">{user.invitedBy.displayName}</td>
                          <td className="py-2 pr-3">{fmt(user.lastLoginAt)}</td>
                          {isFull && (
                            <td className="py-2">
                              <div className="flex flex-wrap justify-end gap-2">
                                {pending ? (
                                  <>
                                    <form action={resendPartnerUserInvite}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <button type="submit" className={smallButton}>
                                        Send igen
                                      </button>
                                    </form>
                                    <form action={revokePartnerUserInvite}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <button type="submit" className={`${smallButton} text-hf-red-dark`}>
                                        Træk tilbage
                                      </button>
                                    </form>
                                  </>
                                ) : (
                                  <>
                                    <form action={setPartnerUserDisabled}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <input type="hidden" name="disable" value={status === "DISABLED" ? "0" : "1"} />
                                      <button type="submit" className={`${smallButton} ${status === "DISABLED" ? "" : "text-hf-red-dark"}`}>
                                        {status === "DISABLED" ? "Aktivér" : "Deaktivér"}
                                      </button>
                                    </form>
                                    <form action={signOutPartnerUserEverywhere}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <button type="submit" className={smallButton}>
                                        Log ud overalt
                                      </button>
                                    </form>
                                    <form action={deletePartnerUser}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <button type="submit" className={`${smallButton} text-hf-red-dark`}>
                                        Slet
                                      </button>
                                    </form>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

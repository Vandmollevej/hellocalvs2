import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminLoginOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { formatPlace } from "@/lib/admin-access";
import { ADMIN_INVITE_LINK_COOKIE, LEVEL_LABEL } from "@/lib/admin-invites";
import {
  inviteAdmin,
  resendAdminInvite,
  revokeAdminInvite,
  setAdminAccessLevel,
  setAdminAllowedIps,
  setAdminDisabled,
  signOutAdminEverywhere,
} from "./actions";

// Admin-brugere (docs/DECISIONS.md 2026-09-29): personer med adgang til
// admin-panelet — separat fra sidemenuen, nås via profil-ikonet øverst.
// Læseadgang eller fuld adgang, invitation (24 t), 2-faktor og godkendelse af
// nyt udstyr er obligatorisk, IP-begrænsning og login-log pr. bruger.

const OUTCOME_LABEL: Record<AdminLoginOutcome, string> = {
  SUCCESS: "Logget ind",
  PASSWORD_FAILED: "Forkert adgangskode",
  CODE_FAILED: "Forkert 2-faktor-kode",
  IP_BLOCKED: "Blokeret (IP)",
  APPROVAL_SENT: "Afventer godkendelse af udstyr",
  APPROVED: "Udstyr godkendt",
  DISABLED: "Blokeret (deaktiveret)",
};
const OUTCOME_BAD: AdminLoginOutcome[] = ["PASSWORD_FAILED", "CODE_FAILED", "IP_BLOCKED", "DISABLED"];

function fmt(date: Date | null | undefined) {
  return date ? date.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" }) : "—";
}

const inputClass = "rounded border border-hf-tan-dark bg-page-bg px-3 py-2";
const smallButton = "hf-type-small rounded border border-hf-tan-dark px-2.5 py-1 hover:bg-hf-tan";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string; user?: string }>;
}) {
  const me = await requireAdminUser();
  if (!me) redirect("/admin/login");
  if (me.adminAccessLevel !== "FULL") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="hf-type-title text-hf-black">Admin-brugere</h1>
        <p className="hf-type-body text-text-secondary">Kun administratorer med fuld adgang kan se og styre admin-brugere.</p>
      </div>
    );
  }
  const { error, invite: inviteState, user: errorUser } = await searchParams;
  const store = await cookies();
  const inviteLink = inviteState ? (store.get(ADMIN_INVITE_LINK_COOKIE)?.value ?? null) : null;

  const now = new Date();
  const [admins, invites] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", passwordHash: { not: null } },
      orderBy: { createdAt: "asc" },
      include: {
        adminLoginEvents: { orderBy: { createdAt: "desc" }, take: 8 },
        adminDevices: { where: { revokedAt: null }, orderBy: { lastSeenAt: "desc" } },
      },
    }),
    prisma.adminInvite.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { invitedBy: { select: { displayName: true } } } }),
  ]);

  const newSignups = invites.filter((i) => i.acceptedAt && !i.acceptSeenAt);
  if (newSignups.length) {
    await prisma.adminInvite.updateMany({ where: { id: { in: newSignups.map((i) => i.id) } }, data: { acceptSeenAt: now } });
  }
  const pendingInvites = invites.filter((i) => !i.acceptedAt);
  const lastSuccess = new Map<string, Date>();
  for (const admin of admins) {
    const ok = await prisma.adminLoginEvent.findFirst({
      where: { userId: admin.id, outcome: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (ok) lastSuccess.set(admin.id, ok.createdAt);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Admin-brugere</h1>
        <p className="hf-type-body text-text-secondary">
          Personer med adgang til admin-panelet. Alle inviterede skal bruge 2-faktor ved hvert login og godkende nyt
          udstyr via deres egen e-mail.
        </p>
      </div>

      {newSignups.map((signup) => (
        <p key={signup.id} className="hf-type-body rounded-lg border border-hf-green-dark bg-hf-white p-3 text-hf-green-dark">
          <strong>{signup.name}</strong> ({signup.email}) har tilmeldt sig som {LEVEL_LABEL[signup.accessLevel].toLowerCase()} —{" "}
          {fmt(signup.acceptedAt)}.
        </p>
      ))}

      <section className="flex flex-col gap-3 hf-surface p-4">
        <h2 className="hf-type-body hf-type-strong">Inviter ny admin-bruger</h2>
        <form action={inviteAdmin} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="hf-type-body flex flex-1 flex-col gap-1">
            Navn
            <input name="name" required className={inputClass} />
          </label>
          <label className="hf-type-body flex flex-1 flex-col gap-1">
            E-mail
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className="hf-type-body flex flex-col gap-1">
            Adgang
            <select name="accessLevel" defaultValue="READ" className={inputClass}>
              <option value="READ">Læseadgang</option>
              <option value="FULL">Administrator (fuld adgang)</option>
            </select>
          </label>
          <button type="submit" className="hf-btn-primary px-4 py-2">
            Send invitation
          </button>
        </form>
        <p className="hf-type-small text-text-secondary">Invitationen gælder i 24 timer og kan kun bruges én gang.</p>
        {error === "invalid" && <p className="hf-type-body text-[var(--hf-color-danger)]">Udfyld navn og en gyldig e-mail.</p>}
        {error === "exists" && <p className="hf-type-body text-[var(--hf-color-danger)]">Der findes allerede en bruger med den e-mail.</p>}
        {inviteState === "sent" && <p className="hf-type-body text-hf-green-dark">Invitationen er sendt på mail.</p>}
        {inviteState === "manual" && (
          <p className="hf-type-body text-[var(--hf-color-danger)]">
            Mailen kunne ikke sendes. Giv modtageren dette link (gælder 24 timer):
          </p>
        )}
        {inviteLink && (
          <input readOnly value={inviteLink} className="hf-type-small w-full rounded border border-hf-tan-dark bg-page-bg px-3 py-2" />
        )}
      </section>

      {pendingInvites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="hf-type-body hf-type-strong">Invitationer</h2>
          <div className="overflow-x-auto">
            <table className="hf-type-body w-full text-left">
              <thead>
                <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-3">Modtager</th>
                  <th className="py-2 pr-3">Adgang</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => {
                  const expired = invite.expiresAt < now;
                  const status = invite.revokedAt ? "Trukket tilbage" : expired ? "Udløbet" : `Afventer (udløber ${fmt(invite.expiresAt)})`;
                  return (
                    <tr key={invite.id} className="border-b border-border-strong/50">
                      <td className="py-2 pr-3">
                        <div className="hf-type-strong">{invite.name}</div>
                        <div className="hf-type-small text-text-secondary">{invite.email}</div>
                      </td>
                      <td className="py-2 pr-3">{LEVEL_LABEL[invite.accessLevel]}</td>
                      <td className="py-2 pr-3">{status}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          {!invite.revokedAt && (
                            <form action={resendAdminInvite}>
                              <input type="hidden" name="inviteId" value={invite.id} />
                              <button type="submit" className={smallButton}>
                                Send igen
                              </button>
                            </form>
                          )}
                          {!invite.revokedAt && !expired && (
                            <form action={revokeAdminInvite}>
                              <input type="hidden" name="inviteId" value={invite.id} />
                              <button type="submit" className={`${smallButton} text-hf-red-dark`}>
                                Træk tilbage
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="hf-type-body hf-type-strong">Brugere med adgang</h2>
        {admins.map((admin) => {
          const isMe = admin.id === me.id;
          const disabled = Boolean(admin.adminDisabledAt);
          return (
            <div key={admin.id} className="flex flex-col gap-3 hf-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="hf-type-body hf-type-strong">
                    {admin.displayName} {isMe && <span className="hf-type-small text-text-muted">(dig)</span>}
                  </div>
                  <div className="hf-type-small text-text-secondary">{admin.email}</div>
                </div>
                <div className="hf-type-small text-right text-text-secondary">
                  <div>
                    {LEVEL_LABEL[admin.adminAccessLevel]} · {disabled ? <span className="text-hf-red-dark">Deaktiveret</span> : "Aktiv"}
                  </div>
                  <div>Sidst logget ind: {fmt(lastSuccess.get(admin.id))}</div>
                </div>
              </div>

              {!isMe && (
                <div className="flex flex-col gap-3 border-t border-hf-tan-dark pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setAdminAccessLevel} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={admin.id} />
                      <select name="accessLevel" defaultValue={admin.adminAccessLevel} className="hf-type-small rounded border border-hf-tan-dark bg-page-bg px-2 py-1">
                        <option value="READ">Læseadgang</option>
                        <option value="FULL">Administrator</option>
                      </select>
                      <button type="submit" className={smallButton}>
                        Skift adgang
                      </button>
                    </form>
                    <form action={setAdminDisabled}>
                      <input type="hidden" name="userId" value={admin.id} />
                      <input type="hidden" name="disable" value={disabled ? "0" : "1"} />
                      <button type="submit" className={`${smallButton} ${disabled ? "" : "text-hf-red-dark"}`}>
                        {disabled ? "Aktivér" : "Deaktivér"}
                      </button>
                    </form>
                    <form action={signOutAdminEverywhere}>
                      <input type="hidden" name="userId" value={admin.id} />
                      <button type="submit" className={smallButton}>
                        Log ud overalt og nulstil udstyr
                      </button>
                    </form>
                  </div>
                  <form action={setAdminAllowedIps} className="flex flex-col gap-1">
                    <input type="hidden" name="userId" value={admin.id} />
                    <label className="hf-type-small text-text-secondary" htmlFor={`ips-${admin.id}`}>
                      IP-begrænsning (tomt = ingen). Kommasepareret, fx 85.1.2.3, 10.0.0.0/24
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`ips-${admin.id}`}
                        name="ips"
                        defaultValue={admin.adminAllowedIps ?? ""}
                        className="hf-type-body flex-1 rounded border border-hf-tan-dark bg-page-bg px-3 py-1.5"
                      />
                      <button type="submit" className={smallButton}>
                        Gem
                      </button>
                    </div>
                    {error === "ip" && errorUser === admin.id && (
                      <p className="hf-type-small text-[var(--hf-color-danger)]">Ugyldig IP-adresse eller område.</p>
                    )}
                  </form>
                </div>
              )}

              <details className="border-t border-hf-tan-dark pt-3">
                <summary className="hf-type-small cursor-pointer text-hf-green-dark">
                  Login-log og godkendt udstyr ({admin.adminDevices.length})
                </summary>
                <div className="mt-3 flex flex-col gap-4">
                  <div>
                    <h3 className="hf-type-small uppercase tracking-wide text-text-muted">Godkendt udstyr</h3>
                    {admin.adminDevices.length === 0 ? (
                      <p className="hf-type-small text-text-secondary">Intet godkendt udstyr endnu.</p>
                    ) : (
                      <ul className="hf-type-small mt-1 flex flex-col gap-1">
                        {admin.adminDevices.map((device) => (
                          <li key={device.id}>
                            {device.label} · {formatPlace(device.country, device.city)} · IP {device.ip ?? "—"} · set første gang{" "}
                            {fmt(device.firstSeenAt)}, sidst {fmt(device.lastSeenAt)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="hf-type-small uppercase tracking-wide text-text-muted">Seneste login-forsøg</h3>
                    {admin.adminLoginEvents.length === 0 ? (
                      <p className="hf-type-small text-text-secondary">Ingen registrerede login endnu.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="hf-type-small mt-1 w-full text-left">
                          <thead>
                            <tr className="border-b border-hf-tan-dark text-text-muted">
                              <th className="py-1 pr-3">Tidspunkt</th>
                              <th className="py-1 pr-3">Resultat</th>
                              <th className="py-1 pr-3">Sted</th>
                              <th className="py-1 pr-3">IP</th>
                              <th className="py-1">Udstyr</th>
                            </tr>
                          </thead>
                          <tbody>
                            {admin.adminLoginEvents.map((event) => (
                              <tr key={event.id} className="border-b border-border-strong/40">
                                <td className="py-1 pr-3 whitespace-nowrap">{fmt(event.createdAt)}</td>
                                <td className={`py-1 pr-3 ${OUTCOME_BAD.includes(event.outcome) ? "text-hf-red-dark" : ""}`}>
                                  {OUTCOME_LABEL[event.outcome]}
                                </td>
                                <td className="py-1 pr-3">{formatPlace(event.country, event.city)}</td>
                                <td className="py-1 pr-3">{event.ip ?? "—"}</td>
                                <td className="py-1">{event.deviceLabel ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          );
        })}
      </section>
    </div>
  );
}

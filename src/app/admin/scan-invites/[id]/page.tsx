import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { decryptPii } from "@/lib/scan/pii";
import { INVITE_LINK_COOKIE } from "@/lib/scan/invites";
import { formatKroner, formatWeekPeriod, groupByIsoWeek } from "@/lib/scan/weeks";
import { summarize } from "@/lib/scan/submissions";
import {
  registerPayout,
  resendInvite,
  reviewSubmission,
  sendAdminMessage,
  setWorkerStatus,
  updateWorkerProfile,
} from "../actions";

// Medarbejderens egen admin-side (docs/OPRETTELSES-APP.md): profil og bank
// (kun admin redigerer, versioneret), indsendelser pr. ISO-uge med
// accept/afvis til aflønning, registrering af udbetaling og beskedtråd.

const DATE_TIME = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" });
const REVIEW_LABEL = { PENDING: "Afventer", ACCEPTED: "Godkendt", REJECTED: "Afvist" } as const;
const inputClass = "rounded border border-border-strong bg-page-bg px-3 py-2 text-sm";

export default async function ScanWorkerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; error?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { id } = await params;
  const { invite, error } = await searchParams;

  const worker = await prisma.scanWorker.findUnique({
    where: { id },
    include: {
      profileVersions: { orderBy: { createdAt: "desc" }, take: 20 },
      submissions: {
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, imageUrl: true, brand: { select: { name: true } } } },
          rejectionReason: true,
        },
      },
      payouts: { orderBy: { paidAt: "desc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!worker) notFound();

  const [reasons, store] = await Promise.all([
    prisma.scanRejectionReason.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    cookies(),
  ]);
  const inviteLink = invite ? store.get(INVITE_LINK_COOKIE)?.value : undefined;
  const totals = summarize(worker.submissions);
  const due = worker.submissions
    .filter((row) => row.reviewStatus === "ACCEPTED" && row.payable && !row.payoutId)
    .reduce((sum, row) => sum + row.amountOre, 0);
  const weeks = groupByIsoWeek(worker.submissions, (row) => row.createdAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/scan-invites" className="text-xs text-text-secondary underline">
            ← scan-invites
          </Link>
          <h1 className="text-lg font-semibold text-text-primary">{worker.name}</h1>
          <p className="text-sm text-text-secondary">
            {worker.email}
            {worker.username ? ` · @${worker.username}` : ""} · status: {worker.status}
            {worker.lastLoginAt ? ` · sidst logget ind ${DATE_TIME.format(worker.lastLoginAt)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {worker.status !== "ACTIVE" && (
            <form action={resendInvite}>
              <input type="hidden" name="workerId" value={worker.id} />
              <button className="rounded border border-border-strong px-3 py-1.5 text-sm">
                {worker.status === "INVITED" ? "Send invitation igen" : "Ny opsætning"}
              </button>
            </form>
          )}
          <form action={setWorkerStatus}>
            <input type="hidden" name="workerId" value={worker.id} />
            <input type="hidden" name="status" value={worker.status === "DISABLED" ? "ACTIVE" : "DISABLED"} />
            <button className="rounded border border-border-strong px-3 py-1.5 text-sm">
              {worker.status === "DISABLED" ? "Genaktivér" : "Deaktivér"}
            </button>
          </form>
        </div>
      </div>

      {invite && (
        <div className="rounded-lg border border-hf-green bg-surface-2 p-3 text-sm">
          {invite === "sent" ? "Invitationen er sendt på mail." : "Mailen kunne ikke sendes (SMTP). Giv medarbejderen linket direkte:"}
          {inviteLink && <p className="mt-1 break-all font-mono text-xs">{inviteLink}</p>}
        </div>
      )}
      {error === "exists" && <p className="text-sm text-[var(--hf-color-danger)]">Der findes allerede en medarbejder med den e-mail.</p>}

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Varer i alt", String(totals.count)],
          ["Afventer", formatKroner(totals.pendingOre)],
          ["Godkendt, ikke udbetalt", formatKroner(due)],
          ["Udbetalt", formatKroner(totals.paidOre)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border-strong bg-surface-2 p-3">
            <p className="text-lg font-semibold text-hf-green-dark">{value}</p>
            <p className="text-xs text-text-secondary">{label}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Indsendelser pr. uge</h2>
        {weeks.length === 0 && <p className="text-sm text-text-secondary">Ingen indsendelser endnu.</p>}
        {weeks.map((group, index) => {
          const weekTotals = summarize(group.rows);
          return (
            <details key={group.week.key} open={index === 0} className="rounded-lg border border-border-strong bg-surface-2">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                Uge {group.week.week} · {formatWeekPeriod(group.week)} — {group.rows.length} varer ·{" "}
                {group.rows.filter((row) => row.reviewStatus === "PENDING").length} afventer
              </summary>
              <p className="px-4 text-xs text-text-secondary">
                Godkendt: {formatKroner(weekTotals.earnedOre)} · Udbetalt: {formatKroner(weekTotals.paidOre)}
              </p>
              <ul className="flex flex-col divide-y divide-border-strong/50 px-4 pb-3">
                {group.rows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                    {row.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.product.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded bg-page-bg text-xs">Intet billede</div>
                    )}
                    <div className="flex-1 text-sm">
                      <p className="font-medium">
                        {row.product.brand?.name ? `${row.product.brand.name} · ` : ""}
                        {row.product.name}
                        <span className="ml-2 text-xs text-text-secondary">
                          {row.kind === "SUPPLEMENT" ? "Supplering" : "Ny vare"}
                          {!row.payable ? " · ikke betalbar (egen vare)" : ""}
                        </span>
                      </p>
                      {(row.missingEnergy || row.missingIngredients) && (
                        <p className="mt-1 rounded border border-[var(--hf-color-danger)] px-2 py-1 text-xs font-semibold text-[var(--hf-color-danger)]">
                          ⚠ Mangler {[row.missingEnergy && "energitabel", row.missingIngredients && "ingrediensliste"].filter(Boolean).join(" og ")}
                        </p>
                      )}
                      <p className="text-xs text-text-secondary">
                        Billede: {DATE_TIME.format(row.capturedAt)} · Oprettet: {DATE_TIME.format(row.createdAt)} ·{" "}
                        {row.storeName ?? "ukendt butik"} ·{" "}
                        <a
                          className="underline"
                          href={`https://maps.google.com/?q=${row.latitude},${row.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                        </a>
                      </p>
                      <p className="text-xs">
                        {REVIEW_LABEL[row.reviewStatus]} · {formatKroner(row.amountOre)}
                        {row.rejectionReason ? ` · ${row.rejectionReason.label}` : ""}
                        {row.rejectionComment ? ` — ${row.rejectionComment}` : ""}
                        {row.payoutId ? " · udbetalt" : ""}
                      </p>
                    </div>
                    {!row.payoutId && (
                      <div className="flex flex-col gap-1">
                        <form action={reviewSubmission}>
                          <input type="hidden" name="submissionId" value={row.id} />
                          <input type="hidden" name="decision" value="accept" />
                          <button className="w-full rounded bg-hf-green-dark px-3 py-1 text-xs font-semibold text-white">Godkend</button>
                        </form>
                        <form action={reviewSubmission} className="flex flex-col gap-1">
                          <input type="hidden" name="submissionId" value={row.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <select name="reasonId" className="rounded border border-border-strong bg-page-bg px-1 py-1 text-xs">
                            {reasons.map((reason) => (
                              <option key={reason.id} value={reason.id}>
                                {reason.label}
                              </option>
                            ))}
                          </select>
                          <input name="comment" placeholder="Kommentar (valgfri)" className="rounded border border-border-strong bg-page-bg px-1 py-1 text-xs" />
                          <button className="rounded border border-[var(--hf-color-danger)] px-3 py-1 text-xs text-[var(--hf-color-danger)]">Afvis</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
        <h2 className="text-base font-semibold">Udbetalinger</h2>
        <form action={registerPayout} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="workerId" value={worker.id} />
          <p className="text-sm">Klar til udbetaling: {formatKroner(due)}</p>
          <input name="note" placeholder="Note (fx overført dato)" className={inputClass} />
          <button disabled={due === 0} className="rounded bg-hf-green-dark px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Registrér udbetaling
          </button>
        </form>
        <ul className="text-sm">
          {worker.payouts.map((payout) => (
            <li key={payout.id}>
              {DATE_TIME.format(payout.paidAt)} · {formatKroner(payout.amountOre)}
              {payout.note ? ` · ${payout.note}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-4">
        <h2 className="text-base font-semibold">Profil og bank (kun admin redigerer)</h2>
        <form action={updateWorkerProfile} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="workerId" value={worker.id} />
          <label className="flex flex-col gap-1 text-sm">Navn<input name="name" defaultValue={worker.name} className={inputClass} /></label>
          <label className="flex flex-col gap-1 text-sm">E-mail<input name="email" defaultValue={worker.email} className={inputClass} /></label>
          <label className="flex flex-col gap-1 text-sm">Telefon<input name="phone" defaultValue={worker.phone ?? ""} className={inputClass} /></label>
          <label className="flex flex-col gap-1 text-sm">Adresse<input name="address" defaultValue={worker.address ?? ""} className={inputClass} /></label>
          <label className="flex flex-col gap-1 text-sm">
            Fødselsdato
            <input name="birthDate" type="date" defaultValue={worker.birthDate?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Køn
            <select name="gender" defaultValue={worker.gender ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="Kvinde">Kvinde</option>
              <option value="Mand">Mand</option>
              <option value="Andet">Andet</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            CPR-nummer {worker.cprEnc ? `(gemt: ${decryptPii(worker.cprEnc) ?? "kan ikke dekrypteres"})` : ""}
            <input name="cpr" placeholder="Tomt = uændret" autoComplete="off" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">Bank<input name="bankName" defaultValue={worker.bankName ?? ""} className={inputClass} /></label>
          <label className="flex flex-col gap-1 text-sm">
            Reg.nr. {worker.bankRegNoEnc ? `(gemt: ${decryptPii(worker.bankRegNoEnc) ?? "?"})` : ""}
            <input name="bankRegNo" placeholder="Tomt = uændret" autoComplete="off" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Kontonr. {worker.bankAccountEnc ? `(gemt: ${decryptPii(worker.bankAccountEnc) ?? "?"})` : ""}
            <input name="bankAccount" placeholder="Tomt = uændret" autoComplete="off" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">PayPal<input name="paypalEmail" defaultValue={worker.paypalEmail ?? ""} className={inputClass} /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="clearSensitive" /> Slet CPR og bankkonto
          </label>
          <button className="rounded bg-hf-green-dark px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Gem profil (ny version)</button>
        </form>
        <details>
          <summary className="cursor-pointer text-sm">Tidligere versioner ({worker.profileVersions.length})</summary>
          <ul className="mt-2 flex flex-col gap-2 text-xs">
            {worker.profileVersions.map((version) => {
              const snap = version.snapshot as Record<string, string | null>;
              return (
                <li key={version.id} className="rounded border border-border-strong/50 p-2">
                  <p className="font-semibold">{DATE_TIME.format(version.createdAt)}</p>
                  <p>
                    {snap.name} · {snap.email} · {snap.phone ?? "—"} · {snap.address ?? "—"} · {snap.gender ?? "—"} ·{" "}
                    {snap.birthDate?.slice(0, 10) ?? "—"} · CPR {decryptPii(snap.cprEnc) ?? "—"} · {snap.bankName ?? "—"}{" "}
                    {decryptPii(snap.bankRegNoEnc) ?? ""} {decryptPii(snap.bankAccountEnc) ?? ""} · PayPal {snap.paypalEmail ?? "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
        <h2 className="text-base font-semibold">Beskeder</h2>
        <ul className="flex flex-col gap-2">
          {worker.messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${message.fromAdmin ? "self-end bg-hf-green-dark text-white" : "self-start bg-page-bg"}`}
            >
              {message.body}
              <span className="block text-[10px] opacity-70">{DATE_TIME.format(message.createdAt)}</span>
            </li>
          ))}
        </ul>
        <form action={sendAdminMessage} className="flex gap-2">
          <input type="hidden" name="workerId" value={worker.id} />
          <input name="body" placeholder="Skriv til medarbejderen" className={`flex-1 ${inputClass}`} />
          <button className="rounded bg-hf-green-dark px-3 py-2 text-sm font-semibold text-white">Send</button>
        </form>
      </section>
    </div>
  );
}

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
const inputClass = "hf-type-body rounded border border-hf-tan-dark bg-page-bg px-3 py-2";

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
          <Link href="/admin/scan-invites" className="hf-type-small text-text-secondary underline">
            ← scan-invites
          </Link>
          <h1 className="hf-type-title text-hf-black">{worker.name}</h1>
          <p className="hf-type-body text-text-secondary">
            {worker.email}
            {worker.username ? ` · @${worker.username}` : ""} · status: {worker.status}
            {worker.lastLoginAt ? ` · sidst logget ind ${DATE_TIME.format(worker.lastLoginAt)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {worker.status !== "ACTIVE" && (
            <form action={resendInvite}>
              <input type="hidden" name="workerId" value={worker.id} />
              <button className="hf-type-body rounded border border-hf-tan-dark px-3 py-1.5">
                {worker.status === "INVITED" ? "Send invitation igen" : "Ny opsætning"}
              </button>
            </form>
          )}
          <form action={setWorkerStatus}>
            <input type="hidden" name="workerId" value={worker.id} />
            <input type="hidden" name="status" value={worker.status === "DISABLED" ? "ACTIVE" : "DISABLED"} />
            <button className="hf-type-body rounded border border-hf-tan-dark px-3 py-1.5">
              {worker.status === "DISABLED" ? "Genaktivér" : "Deaktivér"}
            </button>
          </form>
        </div>
      </div>

      {invite && (
        <div className="hf-type-body rounded-lg border border-hf-green bg-hf-white p-3">
          {invite === "sent" ? "Invitationen er sendt på mail." : "Mailen kunne ikke sendes (SMTP). Giv medarbejderen linket direkte:"}
          {inviteLink && <p className="hf-type-small mt-1 break-all font-mono">{inviteLink}</p>}
        </div>
      )}
      {error === "exists" && <p className="hf-type-body text-[var(--hf-color-danger)]">Der findes allerede en medarbejder med den e-mail.</p>}

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Varer i alt", String(totals.count)],
          ["Afventer", formatKroner(totals.pendingOre)],
          ["Godkendt, ikke udbetalt", formatKroner(due)],
          ["Udbetalt", formatKroner(totals.paidOre)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-hf-tan-dark bg-hf-white p-3">
            <p className="hf-type-title text-hf-green-dark">{value}</p>
            <p className="hf-type-small text-text-secondary">{label}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="hf-type-body hf-type-strong">Indsendelser pr. uge</h2>
        {weeks.length === 0 && <p className="hf-type-body text-text-secondary">Ingen indsendelser endnu.</p>}
        {weeks.map((group, index) => {
          const weekTotals = summarize(group.rows);
          return (
            <details key={group.week.key} open={index === 0} className="rounded-lg border border-hf-tan-dark bg-hf-white">
              <summary className="hf-type-body hf-type-strong cursor-pointer px-4 py-3">
                Uge {group.week.week} · {formatWeekPeriod(group.week)} — {group.rows.length} varer ·{" "}
                {group.rows.filter((row) => row.reviewStatus === "PENDING").length} afventer
              </summary>
              <p className="hf-type-small px-4 text-text-secondary">
                Godkendt: {formatKroner(weekTotals.earnedOre)} · Udbetalt: {formatKroner(weekTotals.paidOre)}
              </p>
              <ul className="flex flex-col divide-y divide-border-strong/50 px-4 pb-3">
                {group.rows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                    {row.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.product.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                    ) : (
                      <div className="hf-type-small flex h-16 w-16 items-center justify-center rounded bg-page-bg">Intet billede</div>
                    )}
                    <div className="hf-type-body flex-1">
                      <p className="hf-type-strong">
                        {row.product.brand?.name ? `${row.product.brand.name} · ` : ""}
                        {row.product.name}
                        <span className="hf-type-small ml-2 text-text-secondary">
                          {row.kind === "SUPPLEMENT" ? "Supplering" : "Ny vare"}
                          {!row.payable ? " · ikke betalbar (egen vare)" : ""}
                        </span>
                      </p>
                      {(row.missingEnergy || row.missingIngredients) && (
                        <p className="hf-type-small hf-type-strong mt-1 rounded border border-[var(--hf-color-danger)] px-2 py-1 text-[var(--hf-color-danger)]">
                          ⚠ Mangler {[row.missingEnergy && "energitabel", row.missingIngredients && "ingrediensliste"].filter(Boolean).join(" og ")}
                        </p>
                      )}
                      <p className="hf-type-small text-text-secondary">
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
                      <p className="hf-type-small">
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
                          <button className="hf-btn-primary w-full px-3 py-1">Godkend</button>
                        </form>
                        <form action={reviewSubmission} className="flex flex-col gap-1">
                          <input type="hidden" name="submissionId" value={row.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <select name="reasonId" className="hf-type-small rounded border border-hf-tan-dark bg-page-bg px-1 py-1">
                            {reasons.map((reason) => (
                              <option key={reason.id} value={reason.id}>
                                {reason.label}
                              </option>
                            ))}
                          </select>
                          <input name="comment" placeholder="Kommentar (valgfri)" className="hf-type-small rounded border border-hf-tan-dark bg-page-bg px-1 py-1" />
                          <button className="hf-type-small rounded border border-[var(--hf-color-danger)] px-3 py-1 text-[var(--hf-color-danger)]">Afvis</button>
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

      <section className="flex flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-body hf-type-strong">Udbetalinger</h2>
        <form action={registerPayout} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="workerId" value={worker.id} />
          <p className="hf-type-body">Klar til udbetaling: {formatKroner(due)}</p>
          <input name="note" placeholder="Note (fx overført dato)" className={inputClass} />
          <button disabled={due === 0} className="hf-btn-primary px-3 py-2 disabled:opacity-40">
            Registrér udbetaling
          </button>
        </form>
        <ul className="hf-type-body">
          {worker.payouts.map((payout) => (
            <li key={payout.id}>
              {DATE_TIME.format(payout.paidAt)} · {formatKroner(payout.amountOre)}
              {payout.note ? ` · ${payout.note}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-body hf-type-strong">Profil og bank (kun admin redigerer)</h2>
        <form action={updateWorkerProfile} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="workerId" value={worker.id} />
          <label className="hf-type-body flex flex-col gap-1">Navn<input name="name" defaultValue={worker.name} className={inputClass} /></label>
          <label className="hf-type-body flex flex-col gap-1">E-mail<input name="email" defaultValue={worker.email} className={inputClass} /></label>
          <label className="hf-type-body flex flex-col gap-1">Telefon<input name="phone" defaultValue={worker.phone ?? ""} className={inputClass} /></label>
          <label className="hf-type-body flex flex-col gap-1">Adresse<input name="address" defaultValue={worker.address ?? ""} className={inputClass} /></label>
          <label className="hf-type-body flex flex-col gap-1">
            Fødselsdato
            <input name="birthDate" type="date" defaultValue={worker.birthDate?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
          </label>
          <label className="hf-type-body flex flex-col gap-1">
            Køn
            <select name="gender" defaultValue={worker.gender ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="Kvinde">Kvinde</option>
              <option value="Mand">Mand</option>
              <option value="Andet">Andet</option>
            </select>
          </label>
          <label className="hf-type-body flex flex-col gap-1">
            CPR-nummer {worker.cprEnc ? `(gemt: ${decryptPii(worker.cprEnc) ?? "kan ikke dekrypteres"})` : ""}
            <input name="cpr" placeholder="Tomt = uændret" autoComplete="off" className={inputClass} />
          </label>
          <label className="hf-type-body flex flex-col gap-1">Bank<input name="bankName" defaultValue={worker.bankName ?? ""} className={inputClass} /></label>
          <label className="hf-type-body flex flex-col gap-1">
            Reg.nr. {worker.bankRegNoEnc ? `(gemt: ${decryptPii(worker.bankRegNoEnc) ?? "?"})` : ""}
            <input name="bankRegNo" placeholder="Tomt = uændret" autoComplete="off" className={inputClass} />
          </label>
          <label className="hf-type-body flex flex-col gap-1">
            Kontonr. {worker.bankAccountEnc ? `(gemt: ${decryptPii(worker.bankAccountEnc) ?? "?"})` : ""}
            <input name="bankAccount" placeholder="Tomt = uændret" autoComplete="off" className={inputClass} />
          </label>
          <label className="hf-type-body flex flex-col gap-1">PayPal<input name="paypalEmail" defaultValue={worker.paypalEmail ?? ""} className={inputClass} /></label>
          <label className="hf-type-body flex items-center gap-2">
            <input type="checkbox" name="clearSensitive" /> Slet CPR og bankkonto
          </label>
          <button className="hf-btn-primary px-4 py-2 sm:col-span-2">Gem profil (ny version)</button>
        </form>
        <details>
          <summary className="hf-type-body cursor-pointer">Tidligere versioner ({worker.profileVersions.length})</summary>
          <ul className="hf-type-small mt-2 flex flex-col gap-2">
            {worker.profileVersions.map((version) => {
              const snap = version.snapshot as Record<string, string | null>;
              return (
                <li key={version.id} className="rounded border border-border-strong/50 p-2">
                  <p className="hf-type-strong">{DATE_TIME.format(version.createdAt)}</p>
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

      <section className="flex flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-body hf-type-strong">Beskeder</h2>
        <ul className="flex flex-col gap-2">
          {worker.messages.map((message) => (
            <li
              key={message.id}
              className={`hf-type-body max-w-[80%] rounded-lg px-3 py-2 ${message.fromAdmin ? "self-end bg-hf-green-dark text-hf-white" : "self-start bg-page-bg"}`}
            >
              {message.body}
              <span className="hf-type-micro text-text-secondary block">{DATE_TIME.format(message.createdAt)}</span>
            </li>
          ))}
        </ul>
        <form action={sendAdminMessage} className="flex gap-2">
          <input type="hidden" name="workerId" value={worker.id} />
          <input name="body" placeholder="Skriv til medarbejderen" className={`flex-1 ${inputClass}`} />
          <button className="hf-btn-primary px-3 py-2">Send</button>
        </form>
      </section>
    </div>
  );
}

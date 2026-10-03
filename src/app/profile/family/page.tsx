"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { FamilyProfileForm, type FamilyProfileInput } from "@/components/family/FamilyProfileForm";
import { AccessToggles, type AccessLevel } from "@/components/family/AccessToggles";
import { InviteFamilyMemberSheet } from "@/components/family/InviteFamilyMemberSheet";
import { FamilySharingSection } from "@/components/family/FamilySharingSection";
import { useFamilyStatus, type FamilyMemberInfo } from "@/components/family/FamilyStatusProvider";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonCards, SkeletonList, SkeletonScreen, SkeletonSectionTitle } from "@/components/hf/Skeleton";

// Familien (docs/FAMILY.md): betaleren opretter profiler, markerer børn,
// laver login-koder og bestemmer, hvem der må se og taste ind for hvem.
// Et almindeligt medlem ser, hvem der bestemmer, og kan melde sig ud.
// Koder er bundet til en e-mail og vises med QR-kode, indtil de er brugt.

type PendingCode = {
  id: string;
  profileId: string | null;
  email: string;
  // Navnet fra "Inviter familiemedlem" (null for koder uden invitation).
  name: string | null;
  code: string;
  expiresAt: string;
  qrDataUrl: string;
};

type AddKind = "member" | "child";
const emptyForm = { displayName: "", birthDate: "", sex: "", heightCm: "", weightKg: "" };

type NewAccess = Record<string, { personOnNew: AccessLevel; newOnPerson: AccessLevel }>;

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return { ok: Boolean(res?.ok), data: data as Record<string, unknown> };
}

function FamilyPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { status, refresh } = useFamilyStatus();
  const [error, setError] = useState<string | null>(null);
  const [pendingCodes, setPendingCodes] = useState<PendingCode[]>([]);
  // Hvilken e-mail-formular er åben: "join" (ny med egen konto) eller et profil-id.
  const [codeFormFor, setCodeFormFor] = useState<string | null>(null);
  const [codeEmail, setCodeEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  // Hvilken oprettelse er åben: "member" (Tilføj familiemedlem) eller
  // "child" (Tilføj barn (under 18)). Profilvælgeren linker med ?add=…
  const addParam = searchParams?.get("add");
  const [addKind, setAddKind] = useState<AddKind | null>(
    addParam === "child" ? "child" : addParam === "member" || addParam === "1" ? "member" : null
  );
  const [showInvite, setShowInvite] = useState(searchParams?.get("invite") === "1");
  const [form, setForm] = useState(emptyForm);
  const [newAccess, setNewAccess] = useState<NewAccess>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isOwner = Boolean(status?.family?.isOwner);
  const loadCodes = useCallback(async () => {
    const result = await send("/api/family/codes", "GET");
    if (result.ok && Array.isArray(result.data.codes)) setPendingCodes(result.data.codes as PendingCode[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- koderne hentes fra serveren, når man er betaler
    if (isOwner) void loadCodes();
  }, [isOwner, loadCodes]);

  function showError(data: Record<string, unknown>) {
    setError(t(`family.error.${typeof data.code === "string" ? data.code : "unknown"}`));
  }

  async function run(url: string, method: string, body?: unknown) {
    setError(null);
    setBusy(true);
    const result = await send(url, method, body);
    setBusy(false);
    if (!result.ok) showError(result.data);
    await refresh();
    return result;
  }

  function openCodeForm(key: string) {
    setError(null);
    setCodeEmail("");
    setCodeFormFor((current) => (current === key ? null : key));
  }

  async function createCode(profileId: string | null) {
    const result = await run("/api/family/codes", "POST", { email: codeEmail, ...(profileId ? { profileId } : {}) });
    if (result.ok) {
      setCodeFormFor(null);
      setCodeEmail("");
      await loadCodes();
    }
  }

  async function revokeCode(pending: PendingCode) {
    if (!window.confirm(t("family.pending.revokeConfirm", { email: pending.email }))) return;
    await run(`/api/family/codes/${pending.id}`, "DELETE");
    await loadCodes();
  }

  async function addProfile() {
    const access = Object.entries(newAccess).map(([personId, levels]) => ({ personId, ...levels }));
    const result = await run("/api/family/members", "POST", { ...form, isChild: addKind === "child", access });
    if (result.ok) {
      setForm(emptyForm);
      setNewAccess({});
      setAddKind(null);
    }
  }

  // Uden familie endnu: den delte formular (ingen andre at give rettigheder).
  async function addProfileFromForm(input: FamilyProfileInput) {
    const result = await run("/api/family/members", "POST", { ...input, access: [] });
    if (result.ok) setAddKind(null);
    return result.ok;
  }

  if (!status) {
    return (
      <SkeletonScreen className="hf-page hf-page--sections">
        <section>
          <SkeletonSectionTitle />
          <SkeletonList rows={3} />
        </section>
        <section>
          <SkeletonSectionTitle />
          <SkeletonCards count={1} height={120} />
        </section>
      </SkeletonScreen>
    );
  }

  const family = status.family;
  const members = family?.members ?? [];
  const nonOwners = members.filter((member) => member.userId !== family?.ownerId);
  const grantLevel = (granteeId: string, subjectId: string): AccessLevel => {
    const grant = family?.grants.find((item) => item.granteeId === granteeId && item.subjectId === subjectId);
    return grant ? (grant.canWrite ? "write" : "read") : "none";
  };
  const newName = form.displayName.trim() || t("family.rights.newProfile");
  const newLevel = (personId: string, key: "personOnNew" | "newOnPerson") => newAccess[personId]?.[key] ?? "none";
  const setNewLevel = (personId: string, key: "personOnNew" | "newOnPerson", level: AccessLevel) =>
    setNewAccess((current) => ({
      ...current,
      [personId]: { ...(current[personId] ?? { personOnNew: "none", newOnPerson: "none" }), [key]: level },
    }));

  const capacity = family?.capacity ?? status.maxProfiles;
  const memberName = (userId: string) => members.find((member) => member.userId === userId)?.displayName ?? "";

  // E-mail-felt + knap, der laver en kode bundet til e-mailen.
  const codeForm = (key: string, profileId: string | null) =>
    codeFormFor === key && (
      <div className="hf-card hf-stack">
        <TextField
          variant="standard"
          type="email"
          label={t("family.invite.emailLabel")}
          value={codeEmail}
          onChange={(event) => setCodeEmail(event.target.value)}
          autoComplete="off"
          className="userback-ignore"
        />
        <p className="hf-type-caption">{t("family.invite.emailHelp")}</p>
        <button
          type="button"
          disabled={busy || !codeEmail.includes("@")}
          onClick={() => createCode(profileId)}
          className="hf-control hf-btn-primary w-full px-4"
        >
          {t("family.invite.submit")}
        </button>
      </div>
    );

  const joinForm = (
    <section>
      <h2 className="hf-type-section-title">{t("family.join.title")}</h2>
      <div className="hf-card hf-stack">
        <p className="hf-type-body">{t("family.join.intro")}</p>
        <p className="hf-type-caption">{t("family.join.scanHint")}</p>
        <TextField
          variant="standard"
          label={t("family.join.codeLabel")}
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
        />
        <TextField
          variant="standard"
          type="email"
          label={t("family.join.emailLabel")}
          value={joinEmail}
          onChange={(event) => setJoinEmail(event.target.value)}
          autoComplete="email"
        />
        <button
          type="button"
          disabled={busy || joinCode.trim().length < 8 || !joinEmail.includes("@")}
          onClick={async () => {
            if (!window.confirm(t("family.join.confirm"))) return;
            const result = await run("/api/family/join", "POST", { code: joinCode, email: joinEmail });
            if (result.ok) {
              setJoinCode("");
              setJoinEmail("");
            }
          }}
          className="hf-control hf-btn-primary w-full px-4"
        >
          {t("family.join.submit")}
        </button>
      </div>
    </section>
  );

  return (
    <div className="hf-page hf-page--sections">
      {error && (
        <p role="alert" className="hf-type-body text-hf-red-dark">
          {error}
        </p>
      )}

      {!family && (
        <>
          <section>
            <h2 className="hf-type-section-title">{t("family.plan.title")}</h2>
            <div className="hf-card hf-stack">
              <p className="hf-type-body">{t("family.plan.intro", { max: status.maxProfiles })}</p>
              {status.hasFamilyPlan ? (
                <>
                  <button type="button" onClick={() => setShowInvite(true)} className="hf-control hf-btn-primary w-full px-4">
                    {t("family.invite.title")}
                  </button>
                  <button type="button" onClick={() => setAddKind("member")} className="hf-control hf-btn-secondary w-full px-4">
                    {t("family.add.addMember")}
                  </button>
                  <button type="button" onClick={() => setAddKind("child")} className="hf-control hf-btn-secondary w-full px-4">
                    {t("family.add.addChild")}
                  </button>
                </>
              ) : (
                <Link href="/profile/subscription" className="hf-control hf-btn-primary w-full px-4">
                  {t("family.plan.requiresPlan")}
                </Link>
              )}
            </div>
          </section>
          {status.hasFamilyPlan && addKind && (
            <section>
              <h2 className="hf-type-section-title">{t("family.add.title")}</h2>
              <div className="hf-card">
                <FamilyProfileForm
                  busy={busy}
                  childOnly={addKind === "child"}
                  memberOnly={addKind === "member"}
                  onSubmit={addProfileFromForm}
                  onCancel={() => setAddKind(null)}
                />
              </div>
            </section>
          )}
          {joinForm}
        </>
      )}

      {family && !family.isOwner && <FamilySharingSection family={family} meId={status.me.id} />}

      {family && !family.isOwner && (
        <section>
          <h2 className="hf-type-section-title">{t("family.member.title")}</h2>
          <div className="hf-card hf-stack">
            <p className="hf-type-body">{t("family.member.intro", { owner: family.ownerName })}</p>
            <Link href="/settings/control-log" className="hf-type-body underline">
              {t("family.member.seeLog")}
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("family.member.leaveConfirm", { owner: family.ownerName }))) {
                  void run("/api/family/leave", "POST");
                }
              }}
              className="hf-control hf-btn-secondary w-full px-4"
            >
              {t("family.member.leave")}
            </button>
          </div>
        </section>
      )}

      {family?.isOwner && (
        <>
          <section>
            <h2 className="hf-type-section-title">{t("family.seats.title")}</h2>
            <div className="hf-card hf-stack">
              <p className="hf-type-body">
                <span className="hf-type-strong">{t("family.seats.membersCount", { count: members.length, max: capacity })}</span>{" "}
                {t("family.seats.membersLabel")}
              </p>
              <p className="hf-type-body">
                <span className="hf-type-strong">{t("family.seats.extraCount", { count: family.extraSeats, max: family.maxExtraSeats })}</span>{" "}
                {t("family.seats.extraLabel")}
              </p>
            </div>
          </section>

          <section>
            <h2 className="hf-type-section-title">{t("family.members.title", { count: members.length, max: capacity })}</h2>
            <div className="overflow-hidden rounded-[8px] bg-hf-tan">
              {members.map((member: FamilyMemberInfo) => (
                <div key={member.userId} className="border-b border-hf-tan-dark px-4 py-2 last:border-b-0">
                  <div className="flex items-center gap-4">
                    <ProfileCircle name={member.displayName} tone="card" />
                    <div className="min-w-0 flex-1">
                      <p className="userback-ignore userback-block hf-type-body truncate">
                        {member.userId === family.ownerId ? t("family.switcher.meLabel", { name: member.displayName }) : member.displayName}
                      </p>
                      <p className="hf-type-caption text-text-secondary">
                        {member.userId === family.ownerId
                          ? t("family.members.payer")
                          : member.hasLogin
                            ? t("family.members.hasLogin")
                            : t("family.members.noLogin")}
                        {member.age !== null ? ` · ${t("family.members.age", { age: member.age })}` : ""}
                      </p>
                    </div>
                  </div>
                  {member.userId !== family.ownerId && (
                    <div className="mt-2 hf-stack">
                      <Toggle
                        label={t("family.members.isChild")}
                        checked={member.isChild}
                        disabled={busy}
                        onChange={(value) => run(`/api/family/members/${member.userId}`, "PATCH", { isChild: value })}
                      />
                      {!member.hasLogin && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openCodeForm(member.userId)}
                          className="hf-control hf-btn-secondary w-full px-4"
                        >
                          {t("family.members.createLoginCode")}
                        </button>
                      )}
                      {codeForm(member.userId, member.userId)}
                      {!member.hasLogin && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const typed = window.prompt(t("family.members.deleteProfileConfirm", { name: member.displayName }));
                            if (typed?.trim().toUpperCase() === "SLET") {
                              void run(`/api/family/members/${member.userId}?deleteProfile=1`, "DELETE", { confirm: "SLET" });
                            }
                          }}
                          className="hf-btn-text self-start text-hf-red-dark"
                        >
                          {t("family.members.deleteProfile")}
                        </button>
                      )}
                      {member.hasLogin && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(t("family.members.removeConfirm", { name: member.displayName }))) {
                              void run(`/api/family/members/${member.userId}`, "DELETE");
                            }
                          }}
                          className="hf-btn-text self-start"
                        >
                          {t("family.members.remove")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {pendingCodes.length > 0 && (
            <section>
              <h2 className="hf-type-section-title">{t("family.pending.title")}</h2>
              <div className="hf-stack">
                {pendingCodes.map((pending) => {
                  const date = new Date(pending.expiresAt).toLocaleDateString("da-DK");
                  return (
                    <div key={pending.id} className="hf-card hf-stack">
                      <p className="userback-ignore userback-block hf-type-card-title break-all">
                        {pending.profileId
                          ? t("family.pending.claimTitle", { name: memberName(pending.profileId), email: pending.email })
                          : pending.name
                            ? t("family.pending.inviteTitle", { name: pending.name, email: pending.email })
                            : t("family.pending.joinTitle", { email: pending.email })}
                      </p>
                      {/* QR-koden er et link med koden og e-mailen krypteret (src/lib/family-invite-token.ts). */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- data-URL fra serveren */}
                      <img
                        src={pending.qrDataUrl}
                        alt={t("family.pending.qrAlt", { email: pending.email })}
                        width={240}
                        height={240}
                        className="userback-ignore userback-block mx-auto rounded-[8px] bg-hf-white"
                      />
                      <p className="userback-ignore userback-block hf-type-body-lg hf-type-strong text-center tracking-widest">{pending.code}</p>
                      <p className="hf-type-caption">
                        {pending.profileId
                          ? t("family.pending.claimHelp", { name: memberName(pending.profileId), email: pending.email, date })
                          : t("family.pending.joinHelp", { email: pending.email, date })}
                      </p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => revokeCode(pending)}
                        className="hf-btn-text self-start"
                      >
                        {t("family.pending.revoke")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {members.length < capacity && (
            <section>
              <h2 className="hf-type-section-title">{t("family.add.title")}</h2>
              {!addKind ? (
                <div className="hf-stack">
                  <button
                    type="button"
                    onClick={() => setShowInvite(true)}
                    className="hf-control hf-btn-primary w-full px-4"
                  >
                    {t("family.invite.title")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddKind("member")}
                    className="hf-control hf-btn-secondary w-full px-4"
                  >
                    {t("family.add.addMember")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddKind("child")}
                    className="hf-control hf-btn-secondary w-full px-4"
                  >
                    {t("family.add.addChild")}
                  </button>
                </div>
              ) : (
                <div className="hf-card hf-stack">
                  <p className="hf-type-card-title">
                    {t(addKind === "child" ? "family.add.addChild" : "family.add.addMember")}
                  </p>
                  {addKind === "child" && <p className="hf-type-caption">{t("family.add.isChildHelp")}</p>}
                  <TextField
                    variant="standard"
                    label={t("family.add.name")}
                    value={form.displayName}
                    className="userback-ignore"
                    onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  />
                  <TextField
                    variant="standard"
                    type="date"
                    label={t("family.add.birthDate")}
                    value={form.birthDate}
                    onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
                  />
                  <label className="hf-type-body flex flex-col gap-2">
                    {t("family.add.sex")}
                    <select
                      value={form.sex}
                      onChange={(event) => setForm({ ...form, sex: event.target.value })}
                      className="hf-type-input h-12 rounded-[8px] border border-hf-gray-border bg-hf-cream px-4"
                    >
                      <option value="">{t("family.add.sexUnknown")}</option>
                      <option value="FEMALE">{t("family.add.sexFemale")}</option>
                      <option value="MALE">{t("family.add.sexMale")}</option>
                    </select>
                  </label>
                  <TextField
                    variant="standard"
                    inputMode="decimal"
                    label={t("family.add.heightCm")}
                    value={form.heightCm}
                    onChange={(event) => setForm({ ...form, heightCm: event.target.value })}
                  />
                  <TextField
                    variant="standard"
                    inputMode="decimal"
                    label={t("family.add.weightKg")}
                    value={form.weightKg}
                    onChange={(event) => setForm({ ...form, weightKg: event.target.value })}
                  />
                  {nonOwners.length > 0 && (
                    <div className="hf-stack">
                      <p className="hf-type-card-title">{t("family.rights.title")}</p>
                      <p className="hf-type-caption">{t("family.rights.intro")}</p>
                      {nonOwners.map((person) => (
                        <div key={person.userId} className="hf-stack">
                          <p className="userback-ignore userback-block hf-type-body hf-type-strong">
                            {t("family.rights.personOn", { person: person.displayName, profile: newName })}
                          </p>
                          <AccessToggles
                            level={newLevel(person.userId, "personOnNew")}
                            onChange={(level) => setNewLevel(person.userId, "personOnNew", level)}
                          />
                          <p className="userback-ignore userback-block hf-type-body hf-type-strong">
                            {t("family.rights.personOn", { person: newName, profile: person.displayName })}
                          </p>
                          <AccessToggles
                            level={newLevel(person.userId, "newOnPerson")}
                            onChange={(level) => setNewLevel(person.userId, "newOnPerson", level)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={busy || !form.displayName.trim()}
                    onClick={addProfile}
                    className="hf-control hf-btn-primary w-full px-4"
                  >
                    {t(addKind === "child" ? "family.add.addChild" : "family.add.addMember")}
                  </button>
                  <button type="button" onClick={() => setAddKind(null)} className="hf-btn-text">
                    {t("common.cancel")}
                  </button>
                </div>
              )}
            </section>
          )}

          {nonOwners.length > 1 && (
            <section>
              <h2 className="hf-type-section-title">{t("family.access.title")}</h2>
              <p className="hf-type-body">{t("family.access.intro")}</p>
              {nonOwners.map((subject) => (
                <div key={subject.userId} className="hf-card mt-2 hf-stack">
                  <p className="userback-ignore userback-block hf-type-card-title">{t("family.access.who", { name: subject.displayName })}</p>
                  {nonOwners
                    .filter((grantee) => grantee.userId !== subject.userId)
                    .map((grantee) => (
                      <div key={grantee.userId} className="hf-stack">
                        <p className="userback-ignore userback-block hf-type-body hf-type-strong">{grantee.displayName}</p>
                        <AccessToggles
                          level={grantLevel(grantee.userId, subject.userId)}
                          disabled={busy}
                          onChange={(level) =>
                            run("/api/family/grants", "PUT", {
                              granteeId: grantee.userId,
                              subjectId: subject.userId,
                              level,
                            })
                          }
                        />
                      </div>
                    ))}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {showInvite && (
        <InviteFamilyMemberSheet
          onClose={() => {
            setShowInvite(false);
            void loadCodes();
          }}
        />
      )}
    </div>
  );
}

export default function FamilyPage() {
  const { t } = useTranslation();
  return (
    <HfScreen title={t("family.title")}>
      <Suspense fallback={null}>
        <FamilyPageContent />
      </Suspense>
    </HfScreen>
  );
}

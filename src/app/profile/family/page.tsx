"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { FamilyProfileForm, type FamilyProfileInput } from "@/components/family/FamilyProfileForm";
import { InviteFamilyMemberSheet } from "@/components/family/InviteFamilyMemberSheet";
import { useFamilyStatus, type FamilyMemberInfo } from "@/components/family/FamilyStatusProvider";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonCards, SkeletonList, SkeletonScreen, SkeletonSectionTitle } from "@/components/hf/Skeleton";

// Familien (docs/FAMILY.md): betaleren opretter profiler, markerer børn,
// laver login-koder og bestemmer, hvem der må se og taste ind for hvem.
// Et almindeligt medlem ser, hvem der bestemmer, og kan melde sig ud.

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
  const [codes, setCodes] = useState<Record<string, { code: string; expiresAt: string }>>({});
  const [joinCode, setJoinCode] = useState("");
  const [showAdd, setShowAdd] = useState(searchParams?.get("add") === "1");
  const [showInvite, setShowInvite] = useState(searchParams?.get("invite") === "1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  async function createCode(profileId: string | null) {
    const result = await run("/api/family/codes", "POST", profileId ? { profileId } : {});
    if (result.ok) {
      setCodes((current) => ({
        ...current,
        [profileId ?? "join"]: { code: String(result.data.code), expiresAt: String(result.data.expiresAt) },
      }));
    }
  }

  async function addProfile(input: FamilyProfileInput) {
    const result = await run("/api/family/members", "POST", input);
    if (result.ok) setShowAdd(false);
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
  const hasGrant = (granteeId: string, subjectId: string) =>
    Boolean(family?.grants.some((grant) => grant.granteeId === granteeId && grant.subjectId === subjectId));

  const codeBox = (key: string) =>
    codes[key] && (
      <div className="mt-2 rounded-[8px] bg-hf-cream p-2">
        <p className="hf-type-body-lg text-center tracking-widest">{codes[key].code}</p>
        <p className="hf-type-caption text-center text-text-secondary">
          {t(key === "join" ? "family.code.joinHelp" : "family.code.claimHelp", {
            date: new Date(codes[key].expiresAt).toLocaleDateString("da-DK"),
          })}
        </p>
      </div>
    );

  const joinForm = (
    <section>
      <h2 className="hf-type-section-title">{t("family.join.title")}</h2>
      <div className="hf-card hf-stack">
        <p className="hf-type-body">{t("family.join.intro")}</p>
        <TextField
          variant="standard"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          aria-label={t("family.join.codeLabel")}
          autoCapitalize="characters"
        />
        <button
          type="button"
          disabled={busy || joinCode.trim().length < 8}
          onClick={async () => {
            if (!window.confirm(t("family.join.confirm"))) return;
            const result = await run("/api/family/join", "POST", { code: joinCode });
            if (result.ok) setJoinCode("");
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
                  <button type="button" onClick={() => setShowAdd(true)} className="hf-control hf-btn-secondary w-full px-4">
                    {t("family.add.newProfile")}
                  </button>
                </>
              ) : (
                <Link href="/profile/subscription" className="hf-control hf-btn-primary w-full px-4">
                  {t("family.plan.requiresPlan")}
                </Link>
              )}
            </div>
          </section>
          {status.hasFamilyPlan && showAdd && (
            <section>
              <h2 className="hf-type-section-title">{t("family.add.title")}</h2>
              <div className="hf-card">
                <FamilyProfileForm busy={busy} onSubmit={addProfile} onCancel={() => setShowAdd(false)} />
              </div>
            </section>
          )}
          {joinForm}
        </>
      )}

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
            <h2 className="hf-type-section-title">{t("family.members.title", { count: members.length, max: status.maxProfiles })}</h2>
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
                          onClick={() => createCode(member.userId)}
                          className="hf-control hf-btn-secondary w-full px-4"
                        >
                          {t("family.members.createLoginCode")}
                        </button>
                      )}
                      {codeBox(member.userId)}
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

          {members.length < status.maxProfiles && (
            <section>
              <h2 className="hf-type-section-title">{t("family.add.title")}</h2>
              {!showAdd ? (
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
                    onClick={() => setShowAdd(true)}
                    className="hf-control hf-btn-secondary w-full px-4"
                  >
                    {t("family.add.newProfile")}
                  </button>
                </div>
              ) : (
                <div className="hf-card">
                  <FamilyProfileForm busy={busy} onSubmit={addProfile} onCancel={() => setShowAdd(false)} />
                </div>
              )}
            </section>
          )}

          {family.invitations.length > 0 && (
            <section>
              <h2 className="hf-type-section-title">{t("family.invite.pendingTitle")}</h2>
              <div className="overflow-hidden rounded-[8px] bg-hf-tan">
                {family.invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center gap-4 border-b border-hf-tan-dark px-4 py-2 last:border-b-0">
                    <ProfileCircle name={invitation.name || invitation.email} tone="card" />
                    <div className="min-w-0 flex-1">
                      <p className="userback-ignore userback-block hf-type-body truncate">{invitation.name || invitation.email}</p>
                      <p className="userback-ignore userback-block hf-type-caption truncate text-text-secondary">{invitation.email}</p>
                      <p className="hf-type-caption text-text-secondary">
                        {t("family.invite.pendingUntil", { date: new Date(invitation.expiresAt).toLocaleDateString("da-DK") })}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(t("family.invite.cancelConfirm", { name: invitation.name || invitation.email }))) {
                          void run(`/api/family/invitations/${invitation.id}`, "DELETE");
                        }
                      }}
                      className="hf-btn-text shrink-0"
                    >
                      {t("family.invite.cancel")}
                    </button>
                  </div>
                ))}
              </div>
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
                      <Toggle
                        key={grantee.userId}
                        label={grantee.displayName}
                        checked={hasGrant(grantee.userId, subject.userId)}
                        disabled={busy}
                        onChange={(value) =>
                          run("/api/family/grants", "PUT", {
                            granteeId: grantee.userId,
                            subjectId: subject.userId,
                            allowed: value,
                          })
                        }
                      />
                    ))}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {showInvite && <InviteFamilyMemberSheet onClose={() => setShowInvite(false)} />}
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

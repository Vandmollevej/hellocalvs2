"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { useFamilyStatus, type FamilyMemberInfo } from "@/components/family/FamilyStatusProvider";
import { useTranslation } from "@/i18n/LocaleProvider";

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
  const [form, setForm] = useState({ displayName: "", birthDate: "", sex: "", isChild: true, heightCm: "", weightKg: "" });
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

  async function addProfile() {
    const result = await run("/api/family/members", "POST", form);
    if (result.ok) {
      setForm({ displayName: "", birthDate: "", sex: "", isChild: true, heightCm: "", weightKg: "" });
      setShowAdd(false);
    }
  }

  if (!status) {
    return <p className="p-4 text-center hf-type-body-sm">{t("common.loading")}</p>;
  }

  const family = status.family;
  const members = family?.members ?? [];
  const nonOwners = members.filter((member) => member.userId !== family?.ownerId);
  const hasGrant = (granteeId: string, subjectId: string) =>
    Boolean(family?.grants.some((grant) => grant.granteeId === granteeId && grant.subjectId === subjectId));

  const codeBox = (key: string) =>
    codes[key] && (
      <div className="mt-2 rounded-[8px] bg-hf-cream p-2">
        <p className="hf-type-body-lg text-center font-bold tracking-widest">{codes[key].code}</p>
        <p className="hf-type-caption text-center text-hf-gray-dark">
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
        <p className="hf-type-body-sm">{t("family.join.intro")}</p>
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
          className="hf-btn-primary hf-type-button h-12 w-full px-4"
        >
          {t("family.join.submit")}
        </button>
      </div>
    </section>
  );

  return (
    <div className="hf-page hf-page--sections">
      {error && (
        <p role="alert" className="hf-type-body-sm text-hf-red-dark">
          {error}
        </p>
      )}

      {!family && (
        <>
          <section>
            <h2 className="hf-type-section-title">{t("family.plan.title")}</h2>
            <div className="hf-card hf-stack">
              <p className="hf-type-body-sm">{t("family.plan.intro", { max: status.maxProfiles })}</p>
              {status.hasFamilyPlan ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run("/api/family", "POST")}
                  className="hf-btn-primary hf-type-button h-12 w-full px-4"
                >
                  {t("family.plan.create")}
                </button>
              ) : (
                <Link href="/profile/subscription" className="hf-btn-primary hf-type-button h-12 w-full px-4">
                  {t("family.plan.requiresPlan")}
                </Link>
              )}
            </div>
          </section>
          {joinForm}
        </>
      )}

      {family && !family.isOwner && (
        <section>
          <h2 className="hf-type-section-title">{t("family.member.title")}</h2>
          <div className="hf-card hf-stack">
            <p className="hf-type-body-sm">{t("family.member.intro", { owner: family.ownerName })}</p>
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
              className="hf-btn-secondary hf-type-button h-12 w-full px-4"
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
                      <p className="hf-type-body truncate">
                        {member.userId === family.ownerId ? t("family.switcher.meLabel", { name: member.displayName }) : member.displayName}
                      </p>
                      <p className="hf-type-caption text-hf-gray-dark">
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
                          className="hf-btn-secondary hf-type-button h-12 w-full px-4"
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
                          className="hf-type-body-sm self-start text-hf-red-dark underline"
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
                          className="hf-type-body-sm self-start underline"
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
                    onClick={() => setShowAdd(true)}
                    className="hf-btn-primary hf-type-button h-12 w-full px-4"
                  >
                    {t("family.add.newProfile")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => createCode(null)}
                    className="hf-btn-secondary hf-type-button h-12 w-full px-4"
                  >
                    {t("family.add.inviteExisting")}
                  </button>
                  {codeBox("join")}
                </div>
              ) : (
                <div className="hf-card hf-stack">
                  <TextField
                    variant="standard"
                    label={t("family.add.name")}
                    value={form.displayName}
                    onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  />
                  <TextField
                    variant="standard"
                    type="date"
                    label={t("family.add.birthDate")}
                    value={form.birthDate}
                    onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
                  />
                  <label className="hf-type-body-sm flex flex-col gap-2">
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
                  <Toggle
                    label={t("family.add.isChild")}
                    description={t("family.add.isChildHelp")}
                    checked={form.isChild}
                    onChange={(value) => setForm({ ...form, isChild: value })}
                  />
                  <button
                    type="button"
                    disabled={busy || !form.displayName.trim()}
                    onClick={addProfile}
                    className="hf-btn-primary hf-type-button h-12 w-full px-4"
                  >
                    {t("family.add.submit")}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="hf-type-body-sm underline">
                    {t("common.cancel")}
                  </button>
                </div>
              )}
            </section>
          )}

          {nonOwners.length > 1 && (
            <section>
              <h2 className="hf-type-section-title">{t("family.access.title")}</h2>
              <p className="hf-type-body-sm">{t("family.access.intro")}</p>
              {nonOwners.map((subject) => (
                <div key={subject.userId} className="hf-card mt-2 hf-stack">
                  <p className="hf-type-card-title">{t("family.access.who", { name: subject.displayName })}</p>
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

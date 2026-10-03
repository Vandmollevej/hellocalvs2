"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { FamilyProfileForm, type FamilyProfileInput } from "@/components/family/FamilyProfileForm";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Inviter familiemedlem" (docs/FAMILY.md 2026-10-03): betaleren skriver navn
// og e-mail og vælger, hvilke af familiens profiler personen skal have
// indsigt i. "Tilføj barn under 18" opretter en børneprofil her i arket, som
// derefter er valgt. Personen får en mail med et link og siger selv ja.
type Step = "invite" | "child" | "sent";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return { ok: Boolean(res?.ok), data: data as Record<string, unknown> };
}

export function InviteFamilyMemberSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { status, refresh } = useFamilyStatus();
  const [step, setStep] = useState<Step>("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status) return null;
  const me = status.me;
  const allMembers = status.family?.members ?? [{ userId: me.id, displayName: me.displayName, isChild: false, sharingDeciderId: me.id }];
  const canAddChild = allMembers.length < (status.family?.capacity ?? status.maxProfiles);
  // Kun profiler, betaleren selv bestemmer over; voksne med eget login deler selv.
  const members = allMembers.filter((member) => member.sharingDeciderId === me.id);

  function errorText(data: Record<string, unknown>) {
    return t(`family.error.${typeof data.code === "string" ? data.code : "unknown"}`);
  }

  function toggle(id: string, value: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function addChild(input: FamilyProfileInput) {
    setError(null);
    setBusy(true);
    const result = await postJson("/api/family/members", { ...input, isChild: true });
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.data));
      return false;
    }
    const profile = result.data.profile as { id?: string } | undefined;
    if (profile?.id) toggle(profile.id, true);
    await refresh();
    setStep("invite");
    return true;
  }

  async function send() {
    setError(null);
    setBusy(true);
    const result = await postJson("/api/family/invitations", { name, email, subjectIds: [...selected] });
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.data));
      return;
    }
    await refresh();
    setStep("sent");
  }

  const footer =
    step === "invite" ? (
      <>
        <button
          type="button"
          disabled={busy || !name.trim() || !email.trim()}
          onClick={send}
          className="hf-control hf-btn-primary w-full px-4"
        >
          {t("family.invite.send")}
        </button>
        <BottomSheetCloseButton className="hf-bottom-sheet__skip">{t("common.cancel")}</BottomSheetCloseButton>
      </>
    ) : step === "sent" ? (
      <BottomSheetCloseButton className="hf-control hf-btn-primary w-full px-4">{t("family.invite.done")}</BottomSheetCloseButton>
    ) : undefined;

  return (
    <BottomSheet
      onClose={onClose}
      size="full"
      title={t(step === "child" ? "family.invite.addChildTitle" : "family.invite.title")}
      footer={footer}
    >
      <div className="hf-stack px-4 pb-4">
        {step === "sent" && (
          <p className="hf-type-body-lg">{t("family.invite.sent", { name: name.trim(), email: email.trim() })}</p>
        )}

        {step === "child" && (
          <>
            <p className="hf-type-body">{t("family.invite.addChildIntro")}</p>
            <FamilyProfileForm busy={busy} childOnly onSubmit={addChild} onCancel={() => setStep("invite")} />
          </>
        )}

        {step === "invite" && (
          <>
            <p className="hf-type-body">{t("family.invite.intro")}</p>
            <TextField
              variant="standard"
              label={t("family.invite.name")}
              value={name}
              className="userback-ignore"
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              variant="standard"
              type="email"
              label={t("family.invite.email")}
              value={email}
              className="userback-ignore"
              autoComplete="off"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
            />

            <h3 className="hf-type-card-title mt-2">{t("family.invite.insightTitle")}</h3>
            <p className="hf-type-caption text-text-secondary">{t("family.invite.insightHelp")}</p>
            <div className="hf-stack">
              {members.map((member) => (
                <Toggle
                  key={member.userId}
                  label={
                    member.userId === me.id
                      ? t("family.switcher.meLabel", { name: member.displayName })
                      : member.isChild
                        ? `${member.displayName} · ${t("family.child")}`
                        : member.displayName
                  }
                  checked={selected.has(member.userId)}
                  disabled={busy}
                  onChange={(value) => toggle(member.userId, value)}
                />
              ))}
            </div>

            {canAddChild && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setStep("child");
                }}
                className="hf-control hf-btn-secondary flex w-full items-center justify-center gap-2 px-4"
              >
                <IconPlus size={18} />
                {t("family.invite.addChild")}
              </button>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="hf-type-body text-hf-red-dark">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

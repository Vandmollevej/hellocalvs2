"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck, IconMail, IconPlus, IconUsers } from "@tabler/icons-react";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { HfChevron } from "@/components/hf/HfChevron";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Skift profil" øverst på Profil (docs/FAMILY.md): profilcirklen med fed
// "Skift profil" og pil under (i stedet for en række over cirklen og navnet
// under, brugerens valg 2026-10-03). Tryk folder listen ud; et tryk på en
// profil skifter til den. Betaleren kan herfra tilføje et familiemedlem eller
// et barn.
export function ProfileSwitcher() {
  const { t } = useTranslation();
  const { status } = useFamilyStatus();
  const [open, setOpen] = useState(false);

  if (!status) return null;
  const canManage = Boolean(status.family?.isOwner || (!status.family && status.hasFamilyPlan));
  if (status.profiles.length < 2 && !canManage) {
    return (
      <div className="flex justify-center py-2">
        <ProfileCircle name={status.activeProfile.displayName} size={96} tone="brand" />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col items-center gap-2 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex flex-col items-center gap-2"
        >
          <ProfileCircle name={status.activeProfile.displayName} size={96} tone="brand" />
          <span className="flex items-center gap-1">
            <span className="hf-type-body hf-type-strong">{t("family.switcher.title")}</span>
            <HfChevron direction={open ? "up" : "down"} className="text-hf-black" />
          </span>
          <span className="userback-ignore userback-block hf-type-caption text-text-secondary">
            {status.activeProfile.id === status.me.id
              ? t("family.switcher.you")
              : t(status.activeProfile.canWrite ? "family.switcher.managing" : "family.switcher.viewing", {
                  name: status.activeProfile.displayName,
                })}
          </span>
        </button>
      </div>
      {open && (
        <div className="overflow-hidden rounded-[8px] bg-hf-tan">
          <ProfileSwitchList onDone={() => setOpen(false)} />
        </div>
      )}
    </section>
  );
}

// Listen over profiler man kan skifte til, plus "Tilføj profil" og
// "Familie og adgang". Bruges af ProfileSwitcher og "Skift konto" i bundmenuen.
export function ProfileSwitchList({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const { status, switchProfile } = useFamilyStatus();
  const [switching, setSwitching] = useState<string | null>(null);

  if (!status) return null;
  const canManage = Boolean(status.family?.isOwner || (!status.family && status.hasFamilyPlan));

  async function choose(profileId: string) {
    if (!status || profileId === status.activeProfile.id) {
      onDone?.();
      return;
    }
    setSwitching(profileId);
    await switchProfile(profileId);
    setSwitching(null);
    onDone?.();
  }

  return (
    <ul className="border-t border-hf-tan-dark">
      {status.profiles.map((profile) => (
        <li key={profile.id} className="border-b border-hf-tan-dark">
          <button
            type="button"
            onClick={() => choose(profile.id)}
            disabled={switching !== null}
            className="flex h-14 w-full items-center gap-4 px-4 text-left"
          >
            <ProfileCircle name={profile.displayName} tone="card" />
            <span className="userback-ignore userback-block hf-type-body flex-1 truncate">
              {profile.id === status.me.id ? t("family.switcher.meLabel", { name: profile.displayName }) : profile.displayName}
            </span>
            {profile.isChild && <span className="hf-type-caption text-text-secondary">{t("family.child")}</span>}
            {profile.id === status.activeProfile.id && <IconCheck size={20} aria-label={t("family.switcher.active")} />}
          </button>
        </li>
      ))}
      {canManage &&
        (["member", "child"] as const).map((kind) => (
          <li key={kind} className="border-b border-hf-tan-dark">
            <Link href={`/profile/family?add=${kind}`} onClick={onDone} className="flex h-12 w-full items-center gap-4 px-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hf-black">
                <IconPlus size={16} />
              </span>
              <span className="hf-type-body flex-1">
                {t(kind === "child" ? "family.add.addChild" : "family.add.addMember")}
              </span>
            </Link>
          </li>
        ))}
      {canManage && (
        <li className="border-b border-hf-tan-dark">
          <Link href="/profile/family?invite=1" onClick={onDone} className="flex h-12 w-full items-center gap-4 px-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hf-black">
              <IconMail size={16} />
            </span>
            <span className="hf-type-body flex-1">{t("family.invite.title")}</span>
          </Link>
        </li>
      )}
      <li>
        <Link href="/profile/family" onClick={onDone} className="flex h-12 w-full items-center gap-4 px-4">
          <IconUsers size={20} />
          <span className="hf-type-body flex-1">{t("family.switcher.manage")}</span>
          <HfChevron className="text-hf-black" />
        </Link>
      </li>
    </ul>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck, IconPlus, IconUsers } from "@tabler/icons-react";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { HfChevron } from "@/components/hf/HfChevron";
import { IconSwitchProfile } from "@/components/icons/SwitchProfile";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Skift profil" øverst på Profil (docs/FAMILY.md): en række for sig selv med
// buet op/ned-pil (ejerens valg 2026-10-03). Tryk folder listen ud; et tryk på
// en profil skifter til den. Den valgte profils cirkel står under rækken.
export function ProfileSwitcher() {
  const { t } = useTranslation();
  const { status, switchProfile } = useFamilyStatus();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  if (!status) return null;
  const canManage = Boolean(status.family?.isOwner || (!status.family && status.hasFamilyPlan));
  if (status.profiles.length < 2 && !canManage) {
    return (
      <div className="flex justify-center py-2">
        <ProfileCircle name={status.activeProfile.displayName} size={96} tone="brand" />
      </div>
    );
  }

  async function choose(profileId: string) {
    if (!status || profileId === status.activeProfile.id) {
      setOpen(false);
      return;
    }
    setSwitching(profileId);
    await switchProfile(profileId);
    setSwitching(null);
    setOpen(false);
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[8px] bg-hf-tan">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex h-12 w-full items-center gap-4 px-4 text-left"
        >
          <span className="flex h-5 w-5 items-center justify-center text-hf-black">
            <IconSwitchProfile size={20} />
          </span>
          <span className="hf-type-body flex-1 truncate">{t("family.switcher.title")}</span>
          <HfChevron direction={open ? "up" : "down"} className="text-hf-black" />
        </button>
        {open && (
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
            {canManage && (
              <li className="border-b border-hf-tan-dark">
                <Link href="/profile/family?add=1" className="flex h-12 w-full items-center gap-4 px-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hf-black">
                    <IconPlus size={16} />
                  </span>
                  <span className="hf-type-body flex-1">{t("family.switcher.addProfile")}</span>
                </Link>
              </li>
            )}
            <li>
              <Link href="/profile/family" className="flex h-12 w-full items-center gap-4 px-4">
                <IconUsers size={20} />
                <span className="hf-type-body flex-1">{t("family.switcher.manage")}</span>
                <HfChevron className="text-hf-black" />
              </Link>
            </li>
          </ul>
        )}
      </div>
      <div className="flex flex-col items-center gap-2 py-2">
        <ProfileCircle name={status.activeProfile.displayName} size={96} tone="brand" />
        <span className="userback-ignore userback-block hf-type-body truncate">{status.activeProfile.displayName}</span>
        <span className="hf-type-caption text-text-secondary">
          {status.activeProfile.id === status.me.id ? t("family.switcher.you") : t("family.switcher.managing")}
        </span>
      </div>
    </section>
  );
}

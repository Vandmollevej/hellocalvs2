"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck, IconPlus, IconUsers } from "@tabler/icons-react";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { HfChevron } from "@/components/hf/HfChevron";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Skift profil" øverst på Profil (docs/FAMILY.md): overlappende cirkler med
// egne initialer og initialerne på de profiler, man styrer. Tryk folder
// listen ud; et tryk på en profil skifter til den.
export function ProfileSwitcher() {
  const { t } = useTranslation();
  const { status, switchProfile } = useFamilyStatus();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  if (!status) return null;
  const canManage = Boolean(status.family?.isOwner || (!status.family && status.hasFamilyPlan));
  if (status.profiles.length < 2 && !canManage) return null;

  // Den viste profil ligger forrest i stakken.
  const stack = [
    status.activeProfile,
    ...status.profiles.filter((profile) => profile.id !== status.activeProfile.id),
  ].slice(0, 4);

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
    <section>
      <h2 className="hf-type-section-title">{t("family.switcher.title")}</h2>
      <div className="overflow-hidden rounded-[8px] bg-hf-tan">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center gap-4 px-4 py-2 text-left"
        >
          <span className="flex items-center">
            {stack.map((profile, index) => (
              <span
                key={profile.id}
                className="rounded-full border-2 border-hf-tan"
                style={{ marginLeft: index === 0 ? 0 : -12, zIndex: stack.length - index }}
              >
                <ProfileCircle name={profile.displayName} size={40} tone="card" />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="hf-type-body block truncate font-bold">{status.activeProfile.displayName}</span>
            <span className="hf-type-caption block text-hf-gray-dark">
              {status.activeProfile.id === status.me.id ? t("family.switcher.you") : t("family.switcher.managing")}
            </span>
          </span>
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
                  <span className="hf-type-body flex-1 truncate">
                    {profile.id === status.me.id ? t("family.switcher.meLabel", { name: profile.displayName }) : profile.displayName}
                  </span>
                  {profile.isChild && <span className="hf-type-caption text-hf-gray-dark">{t("family.child")}</span>}
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
    </section>
  );
}

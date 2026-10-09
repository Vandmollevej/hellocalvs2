"use client";

import { BottomSheet } from "@/components/hf/BottomSheet";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import type { FamilyProfile } from "@/components/family/FamilyStatusProvider";
import { useTranslation } from "@/i18n/LocaleProvider";

// Vælg hvilken styret profil en registrering skal kopieres til ("Kopier til
// konto", docs/FAMILY.md). Vises kun, når man styrer mere end én profil.
export function CopyToAccountSheet({
  profiles,
  onChoose,
  onClose,
}: {
  profiles: FamilyProfile[];
  onChoose: (profile: FamilyProfile) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet ariaLabel={t("family.copy.title")} onClose={onClose}>
      <div className="p-4">
        <ul>
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                onClick={() => onChoose(profile)}
                className="flex h-14 w-full items-center gap-4 border-b border-hf-tan-dark text-left"
              >
                <ProfileCircle name={profile.displayName} tone="card" />
                <span className="hf-type-body flex-1 truncate">{profile.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="hf-control hf-btn-secondary mt-4 w-full px-4">
          {t("common.cancel")}
        </button>
      </div>
    </BottomSheet>
  );
}

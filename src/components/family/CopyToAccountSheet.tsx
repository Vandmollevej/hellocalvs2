"use client";

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
    <div className="fixed inset-0 z-[9000] flex items-end justify-center" role="dialog" aria-label={t("family.copy.title")}>
      <button type="button" aria-label={t("common.close")} onClick={onClose} className="absolute inset-0 bg-[var(--hf-color-overlay)]" />
      <div className="relative w-full max-w-[402px] rounded-t-[8px] bg-hf-cream p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
        <p className="hf-type-card-title">{t("family.copy.title")}</p>
        <ul className="mt-2">
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
        <button type="button" onClick={onClose} className="hf-btn-secondary hf-type-button mt-4 h-12 w-full px-4">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

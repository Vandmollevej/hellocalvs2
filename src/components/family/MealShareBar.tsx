"use client";

import { useEffect, useMemo } from "react";
import { IconCheck } from "@tabler/icons-react";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { PORTION_FACTORS, useMealShare } from "@/lib/meal-share";
import { useTranslation } from "@/i18n/LocaleProvider";

function formatFactor(factor: number) {
  const whole = Math.floor(factor);
  const rest = factor - whole;
  const fraction = rest === 0.25 ? "¼" : rest === 0.5 ? "½" : rest === 0.75 ? "¾" : "";
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

// "Til: Mig · Emma · Oscar" øverst på Tilføj (docs/FAMILY.md). Den viste
// profil får altid registreringen; de valgte andre får en kopi med deres
// egen portion. Vises kun, når man kan taste ind for andre.
export function MealShareBar() {
  const { t } = useTranslation();
  const { status } = useFamilyStatus();
  const { targets, update } = useMealShare();
  const others = useMemo(
    () => (status ? status.profiles.filter((profile) => profile.id !== status.activeProfile.id) : []),
    [status]
  );

  // Ryd valg for profiler, man ikke længere har adgang til.
  useEffect(() => {
    if (!status) return;
    const allowed = new Set(others.map((profile) => profile.id));
    if (targets.some((target) => !allowed.has(target.profileId))) {
      update(targets.filter((target) => allowed.has(target.profileId)));
    }
  }, [status, others, targets, update]);

  if (!status || others.length === 0) return null;

  function toggle(profileId: string) {
    const exists = targets.some((target) => target.profileId === profileId);
    update(exists ? targets.filter((target) => target.profileId !== profileId) : [...targets, { profileId, factor: 1 }]);
  }

  function setFactor(profileId: string, factor: number) {
    update(targets.map((target) => (target.profileId === profileId ? { ...target, factor } : target)));
  }

  return (
    <section aria-label={t("family.share.title")}>
      <p className="hf-type-body-sm mb-2 font-bold">{t("family.share.title")}</p>
      <div className="flex flex-wrap gap-2">
        <span className="flex h-10 items-center gap-2 rounded-full bg-hf-black pl-1 pr-4 text-hf-white">
          <ProfileCircle name={status.activeProfile.displayName} tone="card" />
          <span className="hf-type-body-sm">
            {status.activeProfile.id === status.me.id ? t("family.share.me") : status.activeProfile.displayName}
          </span>
          <IconCheck size={16} />
        </span>
        {others.map((profile) => {
          const selected = targets.find((target) => target.profileId === profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => toggle(profile.id)}
              aria-pressed={Boolean(selected)}
              className={`flex h-10 items-center gap-2 rounded-full border pl-1 pr-4 ${
                selected ? "border-hf-black bg-hf-black text-hf-white" : "border-hf-gray-border bg-hf-cream text-hf-black"
              }`}
            >
              <ProfileCircle name={profile.displayName} tone="card" />
              <span className="hf-type-body-sm">{profile.displayName.split(" ")[0]}</span>
              {selected && <IconCheck size={16} />}
            </button>
          );
        })}
      </div>
      {targets.length > 0 && (
        <div className="mt-2 hf-stack">
          <p className="hf-type-caption text-hf-gray-dark">{t("family.share.portionHelp")}</p>
          {targets.map((target) => {
            const profile = others.find((candidate) => candidate.id === target.profileId);
            if (!profile) return null;
            return (
              <label key={target.profileId} className="flex items-center justify-between gap-4">
                <span className="hf-type-body-sm">{t("family.share.portionFor", { name: profile.displayName })}</span>
                <select
                  value={target.factor}
                  onChange={(event) => setFactor(target.profileId, Number(event.target.value))}
                  className="hf-type-body-sm h-10 rounded-[8px] border border-hf-gray-border bg-hf-cream px-2"
                >
                  {PORTION_FACTORS.map((factor) => (
                    <option key={factor} value={factor}>
                      {t("family.share.portionOption", { factor: formatFactor(factor) })}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

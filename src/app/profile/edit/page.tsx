"use client";

import { activitySummaryUrl } from "@/lib/daily-budget";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconLock } from "@tabler/icons-react";
import { IconPartyPopper } from "@/components/icons/PartyPopper";
import { IconPhotoFrame } from "@/components/icons/PhotoFrame";
import { IconWaistMeasure } from "@/components/icons/WaistMeasure";
import { HfScreen } from "@/components/HfScreen";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { BIRTH_DATE_MIN_AGE_YEARS, BirthDatePicker } from "@/components/ui/BirthDatePicker";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { latestTrendWeight, type MealSample, type WeightSample } from "@/lib/weight-trend";
import { computeAge } from "@/lib/age";
import { ACTIVITY_LEVELS, type ActivityLevel } from "@/lib/activity-level";
import { useTranslation } from "@/i18n/LocaleProvider";
import { cmToIn, formatLength, formatWeight, inToCm, useUnits, weightUnitLabel } from "@/lib/units";
import { formatPhone, validatePhone } from "@/lib/phone";
import { FaceIdButton } from "@/components/FaceIdButton";
import { AccountDeletionSection } from "@/components/profile/AccountDeletionSection";
import { SkeletonForm, SkeletonScreen } from "@/components/hf/Skeleton";
import { EnergyBreakdown } from "@/components/EnergyBreakdown";
import type { EnergySummary } from "@/lib/activity-profile";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
  displayName: string;
  email: string;
  phone: string | null;
  region: string;
  weightKg: number | null;
  startWeightUpdatedAt: string | null;
  createdAt: string;
  targetWeightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};


function formatUpdatedDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="hf-type-small hf-type-strong text-text-secondary uppercase tracking-[0.06em]">
        {label}
      </span>
      {children}
    </label>
  );
}

// Aktivitetsniveau i 5 trin (src/lib/activity-level.ts): fem søjler med
// stigende højde; det valgte trin og dem under er sorte.
function ActivityLevelPicker({
  value,
  onChange,
}: {
  value: ActivityLevel | null;
  onChange: (value: ActivityLevel) => void;
}) {
  const { t } = useTranslation();
  const selectedIndex = value ? ACTIVITY_LEVELS.indexOf(value) : -1;
  return (
    <div className="flex flex-col gap-2">
      <span className="hf-type-small hf-type-strong text-text-secondary uppercase tracking-[0.06em]">
        {t("profile.field.activityLevel")}
      </span>
      <div role="radiogroup" aria-label={t("profile.field.activityLevel")} className="grid grid-cols-5 gap-2">
        {ACTIVITY_LEVELS.map((level, index) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            aria-label={t(`profile.activityLevel.${level}.label`)}
            onClick={() => onChange(level)}
            className="flex h-16 items-end justify-center rounded-xl bg-hf-tan px-2 pb-2"
          >
            <span
              className={`w-full rounded ${index <= selectedIndex ? "bg-hf-black" : "bg-hf-black/15"}`}
              style={{ height: `${8 + index * 8}px` }}
            />
          </button>
        ))}
      </div>
      {value ? (
        <div className="flex flex-col gap-1">
          <span className="hf-type-body hf-type-strong">{t(`profile.activityLevel.${value}.label`)}</span>
          <span className="hf-type-small text-text-secondary">
            {t(`profile.activityLevel.${value}.description`)} {t("profile.activityLevel.note")}
          </span>
        </div>
      ) : (
        <span className="hf-type-small text-text-secondary">{t("profile.activityLevel.notSet")}</span>
      )}
    </div>
  );
}

const tileClass =
  "hf-type-small hf-type-strong flex aspect-square min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-hf-tan px-1 text-center text-hf-black";

const inputClass =
  "hf-type-body hf-field rounded-xl bg-hf-tan px-4 text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green";

export default function ProfileEditPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const units = useUnits();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendWeightKg, setTrendWeightKg] = useState<number | null>(null);
  const [energySummary, setEnergySummary] = useState<EnergySummary | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Telefonnummer (docs/DECISIONS.md 2026-10-02): obligatorisk, kan rettes
  // men ikke slettes. Kladden gemmes først, når den er et gyldigt nummer.
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Regnestykket (docs/ACTIVITY-PAL.md) hentes igen, hver gang profilen
  // gemmes, så det følger vægt, højde, alder, køn og niveau.
  const energyVersion = user
    ? [user.weightKg, user.heightCm, user.birthDate, user.sex, user.activityLevel].join("|")
    : null;
  useEffect(() => {
    if (energyVersion === null) return;
    let cancelled = false;
    fetch(activitySummaryUrl())
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { summary: EnergySummary } | null) => {
        if (!cancelled && data) setEnergySummary(data.summary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [energyVersion]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profil");
        return (await response.json()) as { user: ProfileUser };
      })
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weight-entries")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente vejninger");
        return (await response.json()) as { entries: WeightSample[] };
      })
      .then((weightData) => {
        if (cancelled) return;
        const entries = weightData.entries;
        return fetch("/api/registrations").then(async (response) => {
          if (!response.ok) throw new Error("Kunne ikke hente registreringer");
          return (await response.json()) as { registrations: MealSample[] };
        }).then((registrationData) => {
          if (!cancelled) {
            setTrendWeightKg(latestTrendWeight(entries, registrationData.registrations));
          }
        });
      })
      .catch(() => {
        if (!cancelled) setTrendWeightKg(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof ProfileUser>(key: K, value: ProfileUser[K]) {
    setUser((current) => (current ? { ...current, [key]: value } : current));

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }).catch(() => {});
    }, 500);
  }

  function updateNow<K extends keyof ProfileUser>(key: K, value: ProfileUser[K]) {
    setUser((current) => (current ? { ...current, [key]: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }

  function commitPhone() {
    if (!user || phoneDraft === null) return;
    const parsed = validatePhone(phoneDraft, user.region);
    if (!parsed.ok) {
      setPhoneError(t(parsed.reason === "empty" ? "profile.phoneRequired" : "profile.phoneInvalid"));
      return;
    }
    setPhoneError(null);
    setPhoneDraft(null);
    if (parsed.e164 !== user.phone) updateNow("phone", parsed.e164);
  }

  return (
    <HfScreen
      title={t("profile.section.profile")}
      footer={
        user ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => router.push("/profile/login-approval")}
              className="hf-control w-full rounded-full border border-hf-gray-border px-4"
            >
              {t("loginApproval.toggle")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile/change-password")}
              className="hf-control hf-btn-primary w-full px-4"
            >
              {t("profile.changePasswordButton")}
            </button>
          </div>
        ) : undefined
      }
    >
      {loading || !user ? (
        loading ? (
          <SkeletonScreen className="flex flex-col gap-4 p-4">
            <SkeletonForm fields={2} />
            <div className="grid grid-cols-2 gap-4">
              <SkeletonForm fields={2} />
              <SkeletonForm fields={2} />
            </div>
          </SkeletonScreen>
        ) : (
          <p className="hf-type-body text-text-secondary p-4 text-center">{t("profile.loadError")}</p>
        )
      ) : (
        <div className="flex min-h-full flex-col gap-4 p-4">
          <Field label={t("profile.field.name")}>
            <input
              className={`${inputClass} userback-ignore`}
              value={user.displayName}
              onChange={(event) => update("displayName", event.target.value)}
            />
          </Field>

          <Field label={t("profile.field.email")}>
            <input className={`${inputClass} opacity-60 userback-ignore`} value={user.email} disabled />
          </Field>

          <Field label={t("profile.field.phone")}>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              aria-invalid={phoneError !== null}
              value={phoneDraft ?? formatPhone(user.phone)}
              onChange={(event) => {
                setPhoneDraft(event.target.value);
                setPhoneError(null);
              }}
              onBlur={commitPhone}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className={`hf-type-micro ${phoneError ? "text-hf-red-dark" : "text-text-secondary"}`}>
              {phoneError ?? t("profile.phoneHint")}
            </span>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="hf-type-small hf-type-strong text-text-secondary uppercase tracking-[0.06em]">
                {t("profile.field.weight")}
              </span>
              {/* Altid låst (docs/DECISIONS.md 2026-09-25): feltet kan ikke
                  redigeres; et tryk åbner "Lås"-siden, der henviser til
                  dagsvægt. Tom start-vægt sættes af første vejning. */}
              <button
                type="button"
                onClick={() => router.push("/profile/start-weight")}
                aria-label={t("profile.startWeight.openLockedInfo")}
                className={`${inputClass} flex items-center gap-2 text-left opacity-60`}
              >
                <IconLock size={18} className="shrink-0" />
                <span className="truncate">
                  {user.weightKg !== null
                    ? formatWeight(user.weightKg, units.weight).toUpperCase()
                    : weightUnitLabel(units.weight).toUpperCase()}
                </span>
              </button>
              {trendWeightKg !== null && (
                <span className="hf-type-micro text-text-secondary">
                  {t("profile.trendWeight", { value: formatWeight(trendWeightKg, units.weight) })}
                </span>
              )}
              {user.weightKg !== null && (
                <span className="hf-type-micro text-text-secondary">
                  {t("profile.startWeightUpdated", {
                    date: formatUpdatedDate(user.startWeightUpdatedAt ?? user.createdAt),
                  })}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="hf-type-small hf-type-strong text-text-secondary uppercase tracking-[0.06em]">
                {t("profile.field.height")}
              </span>
              {/* Låst ligesom vægten (docs/DECISIONS.md 2026-10-03): kan kun
                  vælges, mens den er tom; derefter opdateres den kun fra en
                  integration, og et tryk åbner "Lås"-siden. Ikke i et <label>,
                  så hjulets "Færdig" ikke sendes videre til åbne-knappen. */}
              {user.heightCm !== null ? (
                <button
                  type="button"
                  onClick={() => router.push("/profile/height")}
                  aria-label={t("profile.height.openLockedInfo")}
                  className={`${inputClass} flex items-center gap-2 text-left opacity-60`}
                >
                  <IconLock size={18} className="shrink-0" />
                  <span className="truncate">
                    {formatLength(user.heightCm, units.height).toUpperCase()}
                  </span>
                </button>
              ) : (
                <WheelPicker
                  label={t("profile.field.height")}
                  value={null}
                  min={units.height === "in" ? 39 : 100}
                  max={units.height === "in" ? 91 : 230}
                  unit={units.height.toUpperCase()}
                  initialScrollValue={units.height === "in" ? 69 : 175}
                  onChange={(value) => updateNow("heightCm", units.height === "in" ? Math.round(inToCm(value)) : value)}
                />
              )}
            </div>

            <Field label={t("profile.field.birthDate")}>
              <BirthDatePicker
                label={t("profile.field.birthDate")}
                value={user.birthDate}
                onChange={(value) => updateNow("birthDate", value)}
              />
              {(() => {
                const age = computeAge(user.birthDate);
                return age !== null && age >= BIRTH_DATE_MIN_AGE_YEARS ? (
                  <span className="hf-type-micro text-text-secondary">
                    {t("profile.age", { age })}
                  </span>
                ) : null;
              })()}
            </Field>

            <Field label={t("profile.field.sex")}>
              <select
                className={`${inputClass} w-full appearance-none`}
                value={user.sex ?? ""}
                onChange={(event) =>
                  updateNow("sex", event.target.value === "" ? null : (event.target.value as Sex))
                }
              >
                <option value="">{t("profile.sexOption.unspecified")}</option>
                <option value="FEMALE">{t("profile.sexOption.female")}</option>
                <option value="MALE">{t("profile.sexOption.male")}</option>
              </select>
            </Field>
          </div>

          <ActivityLevelPicker value={user.activityLevel} onChange={(value) => updateNow("activityLevel", value)} />

          {energySummary && <EnergyBreakdown summary={energySummary} />}

          {/* Fire ens, kvadratiske genveje (1:1) — teksten må ikke gøre en kasse større. */}
          <div className="mt-2 grid grid-cols-4 gap-2.5">
            <button type="button" onClick={() => router.push("/profile/photo-diary")} className={tileClass}>
              <IconPhotoFrame size={34} stroke={1.6} />
              {t("profile.actions.photoDiary")}
            </button>
            <button type="button" onClick={() => router.push("/profile/weight-calibration")} className={tileClass}>
              <IconBathScale size={34} />
              {t("profile.actions.newWeight")}
            </button>
            <button type="button" onClick={() => router.push("/profile/goals")} className={tileClass}>
              <IconPartyPopper size={34} />
              {t("profile.actions.target")}
            </button>
            <button type="button" onClick={() => router.push("/profile/body-measurements")} className={tileClass}>
              <IconWaistMeasure size={34} sex={user.sex} />
              {t("profile.actions.bodyMeasurements")}
            </button>
          </div>

          <div className="mt-4">
            <FaceIdButton />
          </div>

          <AccountDeletionSection />
        </div>
      )}
    </HfScreen>
  );
}

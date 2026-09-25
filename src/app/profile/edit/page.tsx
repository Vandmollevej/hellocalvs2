"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera, IconLock, IconRulerMeasure, IconTarget } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { BIRTH_DATE_MIN_AGE_YEARS, BirthDatePicker } from "@/components/ui/BirthDatePicker";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { latestTrendWeight, type MealSample, type WeightSample } from "@/lib/weight-trend";
import { computeAge } from "@/lib/age";
import { useTranslation } from "@/i18n/LocaleProvider";
import { FaceIdButton } from "@/components/FaceIdButton";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
  displayName: string;
  email: string;
  weightKg: number | null;
  startWeightUpdatedAt: string | null;
  createdAt: string;
  targetWeightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
  sex: Sex | null;
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};

function formatKg(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);
}

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
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-xl bg-hf-tan px-4 py-3 text-[15px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green";

export default function ProfileEditPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendWeightKg, setTrendWeightKg] = useState<number | null>(null);
  // Kun brugt når start-vægten endnu ikke er sat (første indtastning).
  const [initialWeightInput, setInitialWeightInput] = useState("");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Første indtastning af start-vægt; serveren afviser alle senere ændringer
  // via /api/profile, så herefter er feltet låst.
  function saveInitialWeight() {
    const parsed = Number(initialWeightInput.trim().replace(",", "."));
    if (!initialWeightInput.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg: parsed }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { user: ProfileUser };
        setUser((current) =>
          current
            ? {
                ...current,
                weightKg: data.user.weightKg,
                startWeightUpdatedAt: data.user.startWeightUpdatedAt,
              }
            : current
        );
        setInitialWeightInput("");
      })
      .catch(() => {});
  }

  function updateNow<K extends keyof ProfileUser>(key: K, value: ProfileUser[K]) {
    setUser((current) => (current ? { ...current, [key]: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }

  return (
    <HfScreen
      title={t("profile.section.profile")}
    >
      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("profile.loading") : t("profile.loadError")}
        </p>
      ) : (
        <div className="flex min-h-full flex-col gap-4 p-4">
          <Field label={t("profile.field.name")}>
            <input
              className={inputClass}
              value={user.displayName}
              onChange={(event) => update("displayName", event.target.value)}
            />
          </Field>

          <Field label={t("profile.field.email")}>
            <input className={`${inputClass} opacity-60`} value={user.email} disabled />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {/* div, ikke label: en label ville sende tryk på feltet videre
                til hængelås-knappen — kun selve låsen må være klikbar. */}
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
                  {t("profile.field.weight")}
                </span>
                {user.weightKg !== null && (
                  <button
                    type="button"
                    onClick={() => router.push("/profile/start-weight")}
                    aria-label={t("profile.startWeight.openLockedInfo")}
                    className="flex h-5 w-5 items-center justify-center text-hf-gray"
                  >
                    <IconLock size={16} />
                  </button>
                )}
              </span>
              {user.weightKg !== null ? (
                // Låst (docs/DECISIONS.md 2026-09-22): ændres kun via
                // hængelåsen → e-mailverificering. Dagsvægt er "Vægt".
                <div className={`${inputClass} opacity-60`}>{formatKg(user.weightKg)} KG</div>
              ) : (
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  value={initialWeightInput}
                  placeholder="KG"
                  aria-label={t("profile.field.weight")}
                  onChange={(event) => setInitialWeightInput(event.target.value)}
                  onBlur={saveInitialWeight}
                />
              )}
              {trendWeightKg !== null && (
                <span className="text-[11px] text-hf-black opacity-60">
                  {t("profile.trendWeight", { value: trendWeightKg.toFixed(1) })}
                </span>
              )}
              {user.weightKg !== null && (
                <span className="text-[11px] text-hf-black opacity-60">
                  {t("profile.startWeightUpdated", {
                    date: formatUpdatedDate(user.startWeightUpdatedAt ?? user.createdAt),
                  })}
                </span>
              )}
            </div>

            <Field label={t("profile.field.height")}>
              <WheelPicker
                label={t("profile.field.height")}
                value={user.heightCm !== null ? Math.round(user.heightCm) : null}
                min={100}
                max={230}
                unit="CM"
                initialScrollValue={175}
                onChange={(value) => updateNow("heightCm", value)}
              />
            </Field>

            <Field label={t("profile.field.birthDate")}>
              <BirthDatePicker
                label={t("profile.field.birthDate")}
                value={user.birthDate}
                onChange={(value) => updateNow("birthDate", value)}
              />
              {(() => {
                const age = computeAge(user.birthDate);
                return age !== null && age >= BIRTH_DATE_MIN_AGE_YEARS ? (
                  <span className="text-[11px] text-hf-black opacity-60">
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/profile/photo-diary")}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-hf-tan px-2 py-3 text-center text-[13px] font-semibold text-hf-black"
            >
              <IconCamera size={20} />
              {t("profile.actions.photoDiary")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile/weight-calibration")}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-hf-tan px-2 py-3 text-center text-[13px] font-semibold text-hf-black"
            >
              <IconBathScale size={20} />
              {t("profile.actions.newWeight")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile/goals")}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-hf-tan px-2 py-3 text-center text-[13px] font-semibold text-hf-black"
            >
              <IconTarget size={20} />
              {t("profile.actions.target")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile/body-measurements")}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-hf-tan px-2 py-3 text-center text-[13px] font-semibold text-hf-black"
            >
              <IconRulerMeasure size={20} />
              {t("profile.actions.bodyMeasurements")}
            </button>
          </div>

          <FaceIdButton />
          <button
            type="button"
            onClick={() => router.push("/profile/change-password")}
            className="hf-btn-primary hf-type-button mt-auto h-12 w-full px-4"
          >
            {t("profile.changePasswordButton")}
          </button>
        </div>
      )}
    </HfScreen>
  );
}

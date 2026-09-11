"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera, IconLock, IconLockOpen, IconTarget } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { latestTrendWeight, type MealSample, type WeightSample } from "@/lib/weight-trend";
import { useTranslation } from "@/i18n/LocaleProvider";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
  displayName: string;
  email: string;
  weightKg: number | null;
  targetWeightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};

function weightSourceLabels(t: (key: string) => string): Record<string, string> {
  return {
    MANUAL: t("profile.weightSource.manual"),
    FITBIT: t("profile.weightSource.fitbit"),
    WITHINGS: t("profile.weightSource.withings"),
    APPLE_HEALTH: t("profile.weightSource.appleHealth"),
    GOOGLE_HEALTH: t("profile.weightSource.googleHealth"),
  };
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
  // Start-vægten er ikke tænkt som et felt man løbende opdaterer (det er
  // formålet med "Indtast ny vægt"/vægt-kalibrering) — derfor låst som
  // standard, og kun redigerbart efter et bevidst klik på hængelåsen.
  const [startWeightUnlocked, setStartWeightUnlocked] = useState(false);
  const [trendWeightKg, setTrendWeightKg] = useState<number | null>(null);
  const [lastWeightEntry, setLastWeightEntry] = useState<{ weighedAt: string; source: string } | null>(
    null
  );
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
        return (await response.json()) as {
          entries: (WeightSample & { source: string })[];
        };
      })
      .then((weightData) => {
        if (cancelled) return;
        const entries = weightData.entries;
        if (entries.length > 0) {
          // Nyeste vejning antages først i listen (samme rækkefølge som
          // vaegt-kalibrering-siden viser dem).
          const latest = entries[0];
          setLastWeightEntry({ weighedAt: latest.weighedAt, source: latest.source });
        }
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

  return (
    <HfScreen
      title={t("profile.section.profile")}
      onBack={() => router.back()}
    >
      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("profile.loading") : t("profile.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
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
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
                  {t("profile.field.weight")}
                </span>
                <button
                  type="button"
                  onClick={() => setStartWeightUnlocked((current) => !current)}
                  aria-label={
                    startWeightUnlocked ? t("profile.lockWeight") : t("profile.unlockWeight")
                  }
                  className="flex h-5 w-5 items-center justify-center text-hf-gray"
                >
                  {startWeightUnlocked ? <IconLockOpen size={16} /> : <IconLock size={16} />}
                </button>
              </span>
              <input
                type="number"
                inputMode="decimal"
                className={`${inputClass} ${!startWeightUnlocked ? "opacity-60" : ""}`}
                value={user.weightKg ?? ""}
                disabled={!startWeightUnlocked}
                onChange={(event) =>
                  update("weightKg", event.target.value === "" ? null : Number(event.target.value))
                }
              />
              {trendWeightKg !== null && (
                <span className="text-[11px] text-hf-black opacity-60">
                  {t("profile.trendWeight", { value: trendWeightKg.toFixed(1) })}
                </span>
              )}
              {lastWeightEntry && (
                <span className="text-[11px] text-hf-black opacity-60">
                  {t("profile.updatedFrom", {
                    date: formatUpdatedDate(lastWeightEntry.weighedAt),
                    source: weightSourceLabels(t)[lastWeightEntry.source] ?? lastWeightEntry.source,
                  })}
                </span>
              )}
            </label>

            <Field label={t("profile.field.height")}>
              <WheelPicker
                label={t("profile.field.height")}
                value={user.heightCm !== null ? Math.round(user.heightCm) : null}
                min={100}
                max={230}
                unit="cm"
                initialScrollValue={175}
                onChange={(value) => updateNow("heightCm", value)}
              />
            </Field>

            <Field label={t("profile.field.birthYear")}>
              <WheelPicker
                label={t("profile.field.birthYear")}
                value={user.birthYear}
                min={1920}
                max={new Date().getFullYear()}
                initialScrollValue={1990}
                onChange={(value) => updateNow("birthYear", value)}
              />
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
              onClick={() => router.push("/profile/target-weight")}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-hf-tan px-2 py-3 text-center text-[13px] font-semibold text-hf-black"
            >
              <IconTarget size={20} />
              {t("profile.actions.target")}
            </button>
          </div>
        </div>
      )}
    </HfScreen>
  );
}

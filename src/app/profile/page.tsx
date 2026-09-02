"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconMoon,
  IconScale,
  IconPlugConnected,
  IconSettings,
  IconUser,
  IconCamera,
  IconMessageCircle,
} from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { FullscreenAccordionRow } from "@/components/hf/FullscreenAccordionRow";
import { Toggle } from "@/components/ui/Toggle";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { BottomNav } from "@/components/BottomNav";
import { latestTrendWeight, type MealSample, type WeightSample } from "@/lib/weight-trend";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
  displayName: string;
  email: string;
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};

const WEIGHT_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "manuel indtastning",
  FITBIT: "Fitbit",
  WITHINGS: "Withings",
  APPLE_HEALTH: "Apple Health",
  GOOGLE_HEALTH: "Google Health Connect",
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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendWeightKg, setTrendWeightKg] = useState<number | null>(null);
  const [lastWeightEntry, setLastWeightEntry] = useState<{ weighedAt: string; source: string } | null>(
    null
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
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
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Mine oplysninger" onBack={() => router.back()} />

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? "Henter…" : "Kunne ikke hente profil."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <AccordionCard>
            <FullscreenAccordionRow
              icon={<IconUser size={20} />}
              label="Profil"
              open={profileOpen}
              onOpenChange={setProfileOpen}
            >
              <div className="flex flex-col gap-4 pt-2">
                <Field label="Navn">
                  <input
                    className={inputClass}
                    value={user.displayName}
                    onChange={(event) => update("displayName", event.target.value)}
                  />
                </Field>

                <Field label="E-mail">
                  <input className={`${inputClass} opacity-60`} value={user.email} disabled />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vægt (kg)">
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass}
                      value={user.weightKg ?? ""}
                      onChange={(event) =>
                        update("weightKg", event.target.value === "" ? null : Number(event.target.value))
                      }
                    />
                    {trendWeightKg !== null && (
                      <span className="text-[11px] text-hf-black opacity-60">
                        Trendvægt (AI-estimat): {trendWeightKg.toFixed(1)} kg
                      </span>
                    )}
                    {lastWeightEntry && (
                      <span className="text-[11px] text-hf-black opacity-60">
                        Opdateret d. {formatUpdatedDate(lastWeightEntry.weighedAt)} fra{" "}
                        {WEIGHT_SOURCE_LABELS[lastWeightEntry.source] ?? lastWeightEntry.source}
                      </span>
                    )}
                  </Field>

                  <Field label="Højde (cm)">
                    <WheelPicker
                      label="Højde"
                      value={user.heightCm !== null ? Math.round(user.heightCm) : null}
                      min={100}
                      max={230}
                      unit="cm"
                      initialScrollValue={175}
                      onChange={(value) => updateNow("heightCm", value)}
                    />
                  </Field>

                  <Field label="Fødselsår">
                    <WheelPicker
                      label="Fødselsår"
                      value={user.birthYear}
                      min={1920}
                      max={new Date().getFullYear()}
                      initialScrollValue={1990}
                      onChange={(value) => updateNow("birthYear", value)}
                    />
                  </Field>

                  <Field label="Køn">
                    <select
                      className={`${inputClass} w-full appearance-none`}
                      value={user.sex ?? ""}
                      onChange={(event) =>
                        updateNow("sex", event.target.value === "" ? null : (event.target.value as Sex))
                      }
                    >
                      <option value="">Ikke angivet</option>
                      <option value="FEMALE">Kvinde</option>
                      <option value="MALE">Mand</option>
                    </select>
                  </Field>
                </div>
              </div>
            </FullscreenAccordionRow>

            <ChevronRow
              icon={<IconScale size={20} />}
              label="Vægt kalibrering"
              href="/profile/weight-calibration"
            />
            <ChevronRow
              icon={<IconMoon size={20} />}
              label="Søvnmønster"
              href="/profile/sleep"
            />
            <ChevronRow
              icon={<IconCamera size={20} />}
              label="Billede-dagbog"
              href="/profil/billede-dagbog"
            />
            <ChevronRow
              icon={<IconPlugConnected size={20} />}
              label="Integrationer"
              href="/settings/integrationer"
            />

            <FullscreenAccordionRow
              icon={<IconMessageCircle size={20} />}
              label="Kommunikation"
              open={communicationOpen}
              onOpenChange={setCommunicationOpen}
            >
              <div className="flex flex-col gap-3 pt-2">
                <Toggle
                  label="Jeg ønsker at modtage push-beskeder"
                  checked={user.wantsPushNotifications}
                  onChange={(value) => updateNow("wantsPushNotifications", value)}
                />
                <Toggle
                  label="Jeg vil gerne modtage nyheder om updates"
                  checked={user.wantsUpdateNewsEmails}
                  onChange={(value) => updateNow("wantsUpdateNewsEmails", value)}
                />
                <Toggle
                  label="Jeg vil gerne modtage gode råd pr. mail"
                  checked={user.wantsAdviceEmails}
                  onChange={(value) => updateNow("wantsAdviceEmails", value)}
                />
                <Toggle
                  label="Jeg vil gerne modtage gode tilbud og information fra vores samarbejdspartnere"
                  checked={user.wantsPartnerOffersEmails}
                  onChange={(value) => updateNow("wantsPartnerOffersEmails", value)}
                />
              </div>
            </FullscreenAccordionRow>

            <ChevronRow
              icon={<IconSettings size={20} />}
              label="Indstillinger"
              href="/profile/settings"
              divider={false}
            />
          </AccordionCard>
        </div>
      )}
      <BottomNav />
    </div>
  );
}

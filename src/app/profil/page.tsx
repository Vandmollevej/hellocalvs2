"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconMoon, IconScale, IconHeartbeat } from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
  displayName: string;
  email: string;
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  healthImportRequested: boolean;
};

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

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Mine oplysninger" onBack={() => router.back()} />

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? "Henter…" : "Kunne ikke hente profil."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
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
            </Field>

            <Field label="Højde (cm)">
              <input
                type="number"
                inputMode="decimal"
                className={inputClass}
                value={user.heightCm ?? ""}
                onChange={(event) =>
                  update("heightCm", event.target.value === "" ? null : Number(event.target.value))
                }
              />
            </Field>

            <Field label="Fødselsår">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={user.birthYear ?? ""}
                onChange={(event) =>
                  update("birthYear", event.target.value === "" ? null : Number(event.target.value))
                }
              />
            </Field>

            <Field label="Køn">
              <select
                className={inputClass}
                value={user.sex ?? ""}
                onChange={(event) =>
                  update("sex", event.target.value === "" ? null : (event.target.value as Sex))
                }
              >
                <option value="">Ikke angivet</option>
                <option value="FEMALE">Kvinde</option>
                <option value="MALE">Mand</option>
              </select>
            </Field>
          </div>

          <AccordionCard>
            <ChevronRow
              icon={<IconScale size={20} />}
              label="Vægt kalibrering"
              href="/profil/vaegt-kalibrering"
            />
            <ChevronRow
              icon={<IconMoon size={20} />}
              label="Søvnmønster"
              href="/profil/soevn"
            />
            <ChevronRow
              icon={<IconHeartbeat size={20} />}
              label={user.healthImportRequested ? "Sundhedsdata (smartwatch) — opsat" : "Sundhedsdata (smartwatch)"}
              onClick={() => update("healthImportRequested", !user.healthImportRequested)}
              divider={false}
            />
          </AccordionCard>
        </div>
      )}
    </div>
  );
}

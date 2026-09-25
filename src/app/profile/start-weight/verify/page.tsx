"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Landingsside fra verificeringsmailen (docs/DECISIONS.md 2026-09-22) — kun
// tilgængelig via linket, ikke fra menuer. Tokenet valideres server-side
// både ved visning og igen ved GEM.
type VerifyState = "loading" | "valid" | "invalid" | "saving" | "saved";

const PROFILE_HREF = "/profile/edit";
const MIN_KG = 25;
const MAX_KG = 400;

const primaryButtonClass =
  "hf-type-button flex h-12 w-full items-center justify-center rounded-lg bg-hf-green px-4 font-bold text-hf-white disabled:opacity-50";

function VerifyStartWeightContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<VerifyState>(token ? "loading" : "invalid");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/profile/start-weight?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("invalid");
        return (await response.json()) as { valid: boolean; currentWeightKg: number | null };
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.valid) {
          setState("invalid");
          return;
        }
        if (data.currentWeightKg !== null) {
          setWeight(String(data.currentWeightKg).replace(".", ","));
        }
        setState("valid");
      })
      .catch(() => {
        if (!cancelled) setState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (state === "saving") return;

    const parsed = Number(weight.trim().replace(",", "."));
    if (!weight.trim() || !Number.isFinite(parsed) || parsed < MIN_KG || parsed > MAX_KG) {
      setError(t("profile.startWeight.invalidWeight"));
      return;
    }

    setError(null);
    setState("saving");
    try {
      const response = await fetch("/api/profile/start-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, weightKg: parsed }),
      });
      if (response.ok) {
        setState("saved");
        return;
      }
      const data = (await response.json().catch(() => null)) as { code?: string } | null;
      if (data?.code === "invalid_token") {
        setState("invalid");
        return;
      }
      setError(
        data?.code === "invalid_weight"
          ? t("profile.startWeight.invalidWeight")
          : t("profile.startWeight.saveError")
      );
      setState("valid");
    } catch {
      setError(t("profile.startWeight.saveError"));
      setState("valid");
    }
  }

  const title = state === "saved" ? t("profile.startWeight.title") : t("profile.startWeight.changeTitle");

  return (
    <HfScreen title={title} onBack={() => router.replace(PROFILE_HREF)}>
      {state === "loading" && (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {t("profile.startWeight.validating")}
        </p>
      )}

      {state === "invalid" && (
        <div className="hf-page">
          <h2 className="text-[18px] font-bold text-hf-black">
            {t("profile.startWeight.invalidLinkTitle")}
          </h2>
          <p className="text-[15px] leading-6 text-hf-black">
            {t("profile.startWeight.invalidLinkBody")}
          </p>
          <Link href={PROFILE_HREF} replace className={`${primaryButtonClass} mt-2`}>
            {t("profile.startWeight.backToApp")}
          </Link>
        </div>
      )}

      {state === "saved" && (
        <div className="hf-page">
          <h2 role="status" className="text-[20px] font-bold text-hf-black">
            {t("profile.startWeight.saved")}
          </h2>
          <Link href={PROFILE_HREF} replace className={`${primaryButtonClass} mt-2`}>
            {t("profile.startWeight.backToApp")}
          </Link>
        </div>
      )}

      {(state === "valid" || state === "saving") && (
        <form onSubmit={save} noValidate className="hf-page">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
              {t("profile.startWeight.fieldLabel")}
            </span>
            <span className="flex items-center rounded-xl bg-hf-tan px-4 focus-within:ring-2 focus-within:ring-hf-green">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={weight}
                disabled={state === "saving"}
                onChange={(event) => setWeight(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-hf-black outline-none"
              />
              <span className="ml-2 text-[15px] text-hf-black">KG</span>
            </span>
          </label>

          {error && (
            <p role="alert" className="hf-type-caption text-hf-red-dark">
              {error}
            </p>
          )}

          <button type="submit" disabled={state === "saving"} className={`${primaryButtonClass} mt-2`}>
            {state === "saving" ? t("profile.startWeight.saving") : t("profile.startWeight.save")}
          </button>
        </form>
      )}
    </HfScreen>
  );
}

export default function VerifyStartWeightPage() {
  return (
    <Suspense fallback={null}>
      <VerifyStartWeightContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n/LocaleProvider";
import { hasPasskeyOnDevice, registerPasskey } from "@/lib/passkey-client";
import { markFaceIdDeclined } from "@/lib/login-flow";
import { FaceIdAnimation, type FaceIdPhase } from "@/components/FaceIdAnimation";

// Tilbud efter login: slå Face ID til, så næste login kun kræver ansigtet.
function FaceIdOfferContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const rawNext = useSearchParams().get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kun for indloggede brugere, og kun hvis denne enhed ikke allerede har Face ID
  // (kontoen kan godt have Face ID på en anden enhed).
  useEffect(() => {
    if (hasPasskeyOnDevice()) {
      router.replace(next);
      return;
    }
    fetch("/api/auth/me")
      .then((res) => (res.ok ? setReady(true) : router.replace(next)))
      .catch(() => router.replace(next));
  }, [next, router]);

  const [phase, setPhase] = useState<FaceIdPhase>("idle");

  async function enable() {
    setBusy(true);
    setError(null);
    setPhase("scanning");
    try {
      await registerPasskey();
      setPhase("success"); // videre, når animationen er færdig
    } catch {
      setPhase("failed");
      setError(t("faceIdOffer.error"));
      setBusy(false);
    }
  }

  function skip() {
    markFaceIdDeclined();
    router.replace(next);
  }

  if (!ready) return null;

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">{t("faceIdOffer.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-8">
        <div className="flex justify-center py-4">
          <FaceIdAnimation phase={phase} size={112} onDone={() => router.replace(next)} />
        </div>
        <p className="hf-type-body">{t("faceIdOffer.intro")}</p>
        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
      </div>

      <div className="hf-page">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {busy ? t("faceIdOffer.enabling") : t("faceIdOffer.enable")}
        </button>
        <button type="button" onClick={skip} disabled={busy} className="hf-type-body h-12 w-full underline">
          {t("faceIdOffer.skip")}
        </button>
      </div>
    </div>
  );
}

export default function FaceIdOfferPage() {
  return (
    <Suspense fallback={null}>
      <FaceIdOfferContent />
    </Suspense>
  );
}

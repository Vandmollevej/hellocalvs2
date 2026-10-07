"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { familyPathFromQr } from "@/lib/family-qr-path";

// Scan familiens QR-kode i appen (docs/DECISIONS.md 2026-10-03) og fortsæt
// på familiekode- eller tilknytningssiden.
export default function FamilyQrScanPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let stopped = false;
    const reader = new BrowserQRCodeReader();
    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current ?? undefined, (result) => {
        if (!result || stopped) return;
        const path = familyPathFromQr(result.getText());
        if (!path) {
          setError(t("family.scan.notFamilyCode"));
          return;
        }
        stopped = true;
        controls?.stop();
        router.replace(path);
      })
      .then((started) => {
        controls = started;
        if (stopped) started.stop();
      })
      .catch(() => setError(t("family.scan.noCamera")));
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [router, t]);

  return (
    <HfScreen title={t("family.scan.title")}>
      <div className="hf-page hf-stack">
        <p className="hf-type-body">{t("family.scan.intro")}</p>
        <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden bg-hf-black rounded-card">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        </div>
        {error && (
          <p role="alert" className="hf-type-body text-hf-red-dark">
            {error}
          </p>
        )}
        <Link href="/family-code" className="hf-control hf-btn-secondary w-full px-4">
          {t("family.scan.typeInstead")}
        </Link>
      </div>
    </HfScreen>
  );
}

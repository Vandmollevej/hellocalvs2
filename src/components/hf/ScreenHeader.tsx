"use client";

import Link from "next/link";
import { HfChevron } from "@/components/hf/HfChevron";
import { useTranslation } from "@/i18n/LocaleProvider";

// Tilbagepilen sidder altid til venstre, profilcirklen altid til højre —
// magen til Hello Fresh, ikke omvendt (rettet 2026-09-06, se
// Fejlretninger/FEJLLISTE.md #4). Ikonet er den fælles HfChevron
// (design.md §6.7), aldrig en fuld pil med skaft.
export function ScreenHeader({
  title,
  icon,
  onBack,
  variant = "brand",
}: {
  title: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  variant?: "brand" | "main";
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`hf-appbar ${variant === "main" ? "hf-appbar--main" : "hf-appbar--brand"}`}
    >
      <div className="hf-appbar__slot">
        {onBack && (
          <button onClick={onBack} aria-label={t("common.back")} className="text-hf-white">
            <HfChevron direction="left" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 overflow-hidden">
        {icon && (
          <span className="flex shrink-0 text-hf-white" aria-hidden="true">
            {icon}
          </span>
        )}
        <h1 className="hf-type-nav-title hf-appbar__title">{title}</h1>
      </div>
      <div className="hf-appbar__slot">
        <Link href="/profile" aria-label={t("settings.openProfile")}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-tan text-xs font-bold text-hf-black">
            PT
          </span>
        </Link>
      </div>
    </div>
  );
}

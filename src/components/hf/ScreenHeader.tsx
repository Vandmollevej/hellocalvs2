"use client";

import { usePathname, useRouter } from "next/navigation";
import { isMainFooterRoute, useFooterRootHrefs } from "@/lib/navigation";
import { HfChevron } from "@/components/hf/HfChevron";
import { ProfileAvatarLink } from "@/components/ProfileAvatarLink";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useIsCompactLandscape } from "@/hooks/useIsCompactLandscape";

// Tilbagepilen sidder altid til venstre, profilcirklen altid til højre —
// magen til Hello Fresh, ikke omvendt (rettet 2026-09-06, se
// Fejlretninger/FEJLLISTE.md #4). Ikonet er den fælles HfChevron
// (design.md §6.7), aldrig en fuld pil med skaft.
//
// Tilbagepilen vises automatisk på alle routede sider undtagen footer-
// rødderne (src/lib/navigation.ts, docs/DECISIONS.md 2026-09-22) — sider
// skal ikke selv sende onBack for at få den. onBack overstyrer kun selve
// handlingen (fx et flertrinsflow der skal et trin tilbage i stedet).
export function ScreenHeader({
  title,
  icon,
  onBack,
  hideBackButton = false,
  variant = "brand",
  titleClassName,
}: {
  title: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  hideBackButton?: boolean;
  variant?: "brand" | "main";
  titleClassName?: string;
}) {
  const { t } = useTranslation();
  const isCompact = useIsCompactLandscape();
  const router = useRouter();
  const pathname = usePathname();
  const footerRoots = useFooterRootHrefs();
  const showBack = !hideBackButton && !isMainFooterRoute(pathname, footerRoots);

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    // Åbnet direkte (ingen app-historik) → fald tilbage til forsiden.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  return (
    <div
      className={`hf-appbar ${variant === "main" ? "hf-appbar--main" : "hf-appbar--brand"} ${
        isCompact ? "hf-appbar--compact" : ""
      }`}
    >
      <div className="hf-appbar__slot">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label={t("common.back")}
            className="flex h-full w-full items-center justify-center text-hf-white focus-visible:outline-2 focus-visible:outline-hf-white"
          >
            <HfChevron direction="left" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-center gap-2">
        {icon && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-hf-white" aria-hidden="true">
            {icon}
          </span>
        )}
        <h1 className={`hf-type-nav-title hf-appbar__title ${titleClassName ?? ""}`}>{title}</h1>
        {icon && <span className="h-6 w-6 shrink-0" aria-hidden="true" />}
      </div>
      <ProfileAvatarLink />
    </div>
  );
}

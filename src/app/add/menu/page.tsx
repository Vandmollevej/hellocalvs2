"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { AddMenuList } from "@/components/add/AddMenuList";
import { useTranslation } from "@/i18n/LocaleProvider";

// Direct-link fallback for the add menu. The app itself opens the same list
// in a bottom sheet (AddMenuSheet) from the front-page wheel's "Se alle" slot
// and the calendar's hour "Tilføj" bar (KRAV.md "Bundark", 2026-09-27).
function AddMenuContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  return (
    <HfScreen title={t("addMenu.title")}>
      <AddMenuList date={searchParams.get("date")} time={searchParams.get("time")} />
    </HfScreen>
  );
}

export default function AddMenuPage() {
  return (
    <Suspense fallback={null}>
      <AddMenuContent />
    </Suspense>
  );
}

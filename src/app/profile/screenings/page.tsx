"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActionLink } from "@/components/hf/ActionButton";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { HfLoader } from "@/components/hf/HfLoader";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { ScreeningFillSheet } from "@/components/screenings/ScreeningFillSheet";
import { ScreeningRow } from "@/components/screenings/ScreeningRow";
import { ScreeningSwipeRow } from "@/components/screenings/ScreeningSwipeRow";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  deleteScreening,
  fetchScreenings,
  patchScreening,
} from "@/lib/screenings-client";
import type { ScreeningDto } from "@/lib/screenings";

// Profil → Screeninger (docs/DECISIONS.md 2026-10-09): "Opret ny screening"
// øverst, Screeningrapporter, listen med swipe (aktivér/deaktivér/slet).
// ?fill=1 åbner udfyldningsarket (valget i Tilføj-menuen). Ingen grafer i bunden.
function ScreeningsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [screenings, setScreenings] = useState<ScreeningDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ScreeningDto | null>(null);
  const fillOpen = searchParams.get("fill") === "1";

  const load = useCallback(() => {
    fetchScreenings(t)
      .then(setScreenings)
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Søvn-rækken viser, om "Oplevelse af søvn" er slået til (standard: til).
  const [sleepActive, setSleepActive] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) =>
        response.ok ? ((await response.json()) as { user: { sleepQualityPromptEnabled?: boolean } }) : null,
      )
      .then((data) => {
        if (!cancelled && data) setSleepActive(data.user.sleepQualityPromptEnabled !== false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const statusText = (active: boolean) =>
    active ? t("screenings.statusActive") : t("screenings.statusInactive");

  async function toggleActive(screening: ScreeningDto) {
    setScreenings((list) => list?.map((s) => (s.id === screening.id ? { ...s, active: !s.active } : s)) ?? null);
    await patchScreening(screening.id, { active: !screening.active });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    setScreenings((list) => list?.filter((s) => s.id !== id) ?? null);
    await deleteScreening(id);
  }

  return (
    <HfScreen title={t("screenings.title")}>
      <div className="hf-page">
        <p className="hf-type-body text-text-secondary">{t("screenings.intro")}</p>

        <Link
          href="/profile/screenings/new"
          className="hf-type-body hf-type-strong flex items-center gap-2 self-end text-hf-black"
        >
          <IconPlus size={20} aria-hidden="true" />
          {t("screenings.createNew")}
        </Link>

        {!screenings && !failed && (
          <div className="flex justify-center py-6">
            <HfLoader />
          </div>
        )}
        {failed && <p className="hf-type-body text-text-secondary">{t("screenings.loadError")}</p>}

        {screenings && (
          <AccordionCard>
            {/* Søvn er en fast række (kan ikke slettes): "Oplevelse af søvn" til/fra
                (bruger 2026-10-16, flyttet fra Visning). Søvnmønsteret ligger på Profil. */}
            <ScreeningRow
              href="/settings/display/sleep-quality"
              sleep
              label={t("screenings.sleep")}
              active={sleepActive}
              statusText={statusText(sleepActive)}
              divider={screenings.length > 0}
            />
            {screenings.map((screening, index) => (
              <ScreeningSwipeRow
                key={screening.id}
                active={screening.active}
                onToggleActive={() => toggleActive(screening)}
                onDelete={() => setPendingDelete(screening)}
              >
                <ScreeningRow
                  href={`/profile/screenings/${screening.id}`}
                  label={screening.name}
                  active={screening.active}
                  statusText={statusText(screening.active)}
                  divider={index < screenings.length - 1}
                />
              </ScreeningSwipeRow>
            ))}
          </AccordionCard>
        )}

        <ActionLink variant="secondary" href="/profile/screenings/reports">
          {t("screenings.reports")}
        </ActionLink>
      </div>

      {fillOpen && screenings && (
        <ScreeningFillSheet
          screenings={screenings}
          onClose={() => router.replace("/profile/screenings")}
        />
      )}
      {pendingDelete && (
        <BottomSheet onClose={() => setPendingDelete(null)} title={t("screenings.deleteTitle")}>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <p className="hf-type-body text-text-secondary">{t("screenings.deleteBody")}</p>
            <button type="button" className="hf-btn-danger w-full" onClick={confirmDelete}>
              {t("screenings.delete")}
            </button>
            <BottomSheetCloseButton className="hf-btn-secondary w-full">{t("screenings.back")}</BottomSheetCloseButton>
          </div>
        </BottomSheet>
      )}
    </HfScreen>
  );
}

export default function ScreeningsPage() {
  return (
    <Suspense fallback={null}>
      <ScreeningsContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown, IconChevronRight, IconMoon, IconPlus } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActionLink } from "@/components/hf/ActionButton";
import { HfLoader } from "@/components/hf/HfLoader";
import { MiniLineChart } from "@/components/hf/MiniChart";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { ScreeningFillSheet } from "@/components/screenings/ScreeningFillSheet";
import { ScreeningSwipeRow } from "@/components/screenings/ScreeningSwipeRow";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  deleteScreening,
  fetchEntriesInRange,
  fetchScreenings,
  isoDaysAgo,
  patchScreening,
  todayIso,
} from "@/lib/screenings-client";
import {
  SCREENING_PERIODS,
  type ScreeningDto,
  type ScreeningEntryDto,
  type ScreeningPeriodKey,
} from "@/lib/screenings";

// Profil → Screeninger (docs/DECISIONS.md 2026-10-09): "Opret ny screening"
// øverst, Screeningrapporter, listen med swipe (aktivér/deaktivér/slet) og en
// graf pr. screening for den valgte periode. ?fill=1 åbner udfyldningsarket
// (valget i Tilføj-menuen).
function ScreeningsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [screenings, setScreenings] = useState<ScreeningDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<ScreeningPeriodKey>("30");
  const [entries, setEntries] = useState<ScreeningEntryDto[]>([]);
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

  const loadEntries = useCallback(() => {
    fetchEntriesInRange(isoDaysAgo(Number(period)), todayIso())
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [period]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

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

  const withData = (screenings ?? []).filter((s) => s.active && entries.some((e) => e.screeningId === s.id));

  return (
    <HfScreen title={t("screenings.title")}>
      <div className="hf-page">
        <p className="hf-type-body text-text-secondary">{t("screenings.intro")}</p>

        <Link
          href="/profile/screenings/new"
          className="hf-type-body hf-type-strong flex items-center gap-2 text-hf-black"
        >
          <IconPlus size={20} />
          {t("screenings.createNew")}
        </Link>

        <ActionLink variant="secondary" href="/profile/screenings/reports">
          {t("screenings.reports")}
        </ActionLink>

        {!screenings && !failed && (
          <div className="flex justify-center py-6">
            <HfLoader />
          </div>
        )}
        {failed && <p className="hf-type-body text-text-secondary">{t("screenings.loadError")}</p>}

        {screenings && (
          <div className="hf-card overflow-hidden !p-0">
            {/* Søvn er en fast række, der peger på søvnmønsteret (altid aktiv). */}
            <Link href="/profile/sleep" className="flex items-center gap-3 border-b border-hf-tan-dark px-4 py-3">
              <span className="size-2.5 shrink-0 rounded-full bg-hf-green" aria-hidden="true" />
              <IconMoon size={20} />
              <span className="hf-type-body flex-1 text-hf-black">{t("screenings.sleep")}</span>
              <span className="hf-type-small text-hf-green-dark">{t("screenings.statusActive")}</span>
              <IconChevronRight size={18} />
            </Link>
            {screenings.map((screening, index) => (
              <div key={screening.id} className={index < screenings.length - 1 ? "border-b border-hf-tan-dark" : ""}>
                <ScreeningSwipeRow
                  active={screening.active}
                  onToggleActive={() => toggleActive(screening)}
                  onDelete={() => setPendingDelete(screening)}
                >
                  <Link
                    href={`/profile/screenings/${screening.id}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${screening.active ? "bg-hf-green" : "bg-hf-tan-dark"}`}
                      aria-hidden="true"
                    />
                    <span className={`hf-type-body flex-1 ${screening.active ? "text-hf-black" : "text-text-secondary"}`}>
                      {screening.name}
                    </span>
                    <span className={`hf-type-small ${screening.active ? "text-hf-green-dark" : "text-text-secondary"}`}>
                      {screening.active ? t("screenings.statusActive") : t("screenings.statusInactive")}
                    </span>
                    <IconChevronRight size={18} />
                  </Link>
                </ScreeningSwipeRow>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <select
            aria-label={t("screenings.periodAria")}
            className="hf-field hf-type-body w-full appearance-none rounded-xl border border-hf-tan-dark bg-hf-white pl-3 pr-9 text-hf-black"
            value={period}
            onChange={(event) => setPeriod(event.target.value as ScreeningPeriodKey)}
          >
            {SCREENING_PERIODS.map((key) => (
              <option key={key} value={key}>
                {t(`screenings.period.d${key}`)}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={14}
            stroke={2.5}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hf-black"
          />
        </div>

        {withData.length === 0 ? (
          <p className="hf-type-body text-text-secondary">{t("screenings.chartEmpty")}</p>
        ) : (
          withData.map((screening) => (
            <div key={screening.id} className="hf-card flex flex-col gap-2">
              <h3 className="hf-type-body hf-type-strong text-hf-black">{screening.name}</h3>
              <MiniLineChart
                points={entries
                  .filter((e) => e.screeningId === screening.id)
                  .map((e) => ({ label: e.date, value: e.value }))}
                emptyLabel={t("screenings.chartEmpty")}
              />
            </div>
          ))
        )}
      </div>

      {fillOpen && screenings && (
        <ScreeningFillSheet
          screenings={screenings}
          onClose={() => router.replace("/profile/screenings")}
          onSaved={loadEntries}
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

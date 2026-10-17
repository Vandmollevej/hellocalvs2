"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { IconWaterGlass } from "@/components/icons/WaterGlass";
import { FoodRow } from "@/components/FoodRow";
import { HfScreen } from "@/components/HfScreen";
import { HfSlider } from "@/components/hf/HfSlider";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonCards, SkeletonScreen, SkeletonSectionTitle } from "@/components/hf/Skeleton";
import { SwipeableRow } from "@/components/SwipeableRow";
import { EntryDetailsSheet } from "@/components/hf/EntryDetailsSheet";
import { ItemListRow, ItemListSection } from "@/components/hf/ItemList";
import { dayHeadingLabel, dayKey } from "@/lib/day-heading";
import { intlLocale } from "@/i18n";

type WaterEntry = {
  id: string;
  amountMl: number;
  loggedAt: string;
};

const MIN_ML = 0;
const MAX_ML = 1000;
const STEP_ML = 25;

// design.md §6.11: no HelloFresh reference for this screen. Four container
// presets tap-select an ml amount onto the slider below; the slider stays
// freely adjustable afterwards for a manual amount. The slider snaps to 25 ml;
// the amount field can be typed into directly for any other exact amount. Presets are labelled in cl
// but register the exact ml amount. Images are alpha-trimmed PNGs; bottles get
// descending heights (75>50>33>25 cl) so the size difference is clearly visible.
const CONTAINERS = [
  { key: "bottleLarge", ml: 750, src: "/icons/water/bottle-large.png", width: 75, boxHeight: 68 },
  { key: "bottleSmall", ml: 500, src: "/icons/water/bottle-small.png", width: 91, boxHeight: 58 },
  { key: "glassLarge", ml: 330, src: "/icons/water/glass-large.png", width: 113, boxHeight: 48 },
  { key: "glassSmall", ml: 250, src: "/icons/water/glass-small.png", width: 129, boxHeight: 38 },
] as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Newest first; entries from the same calendar day share one date separator.
function groupByDate(entries: WaterEntry[]) {
  const sorted = [...entries].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  const groups: { key: string; date: Date; entries: WaterEntry[] }[] = [];
  for (const entry of sorted) {
    const key = dayKey(new Date(entry.loggedAt));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, date: new Date(entry.loggedAt), entries: [entry] });
  }
  return groups;
}

export default function WaterCreatePage() {
  const { t, locale } = useTranslation();
  const [amountMl, setAmountMl] = useState(250);
  // Swipe → Slet åbner samme bekræftelse som forsidens dagsliste.
  const [confirmDelete, setConfirmDelete] = useState<WaterEntry | null>(null);
  // Rå tekst mens mængdefeltet redigeres, så et tomt felt ikke tvinges til 0.
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/water-entries")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { entries: WaterEntry[] };
      })
      .then((data) => setEntries(data.entries.slice(0, 5)))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteEntry(entry: WaterEntry) {
    const previous = entries;
    setEntries((current) => current.filter((candidate) => candidate.id !== entry.id));
    const response = await fetch(`/api/water-entries/${entry.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) setEntries(previous);
    else load();
  }

  function pickContainer(key: string, ml: number) {
    setSelectedKey(key);
    setAmountMl(ml);
    setSaved(false);
  }

  async function handleSubmit() {
    if (amountMl <= 0) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/water-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl }),
      });
      if (!response.ok) {
        setSaveError(t("waterLog.saveError"));
        return;
      }
      setSaved(true);
      setSelectedKey(null);
      load();
    } catch {
      setSaveError(t("waterLog.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title={t("waterLog.title")} icon={<IconWaterGlass size={20} stroke={2} />}>
      <div className="hf-page">
        <div className="hf-card hf-card--brand">
          <p className="hf-type-small">{t("waterLog.intro")}</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {CONTAINERS.map(({ key, ml, src, width, boxHeight }) => {
            const isSelected = selectedKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickContainer(key, ml)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${
                  isSelected ? "hf-selected" : "bg-hf-tan text-hf-black"
                }`}
              >
                <span className="flex h-[72px] w-full items-end justify-center">
                  <Image
                    src={src}
                    alt=""
                    aria-hidden="true"
                    width={width}
                    height={240}
                    className="block w-auto max-w-full object-contain"
                    style={{ height: boxHeight }}
                  />
                </span>
                <span
                  className="hf-type-micro hf-type-strong"
                >
                  {ml / 10}cl
                </span>
              </button>
            );
          })}
        </div>

        <div className="lg:gap-5 lg:p-6 hf-card--form hf-card">
          <div className="flex items-baseline justify-between">
            <span className="hf-type-small hf-type-strong hf-water-amount__label text-hf-black">
              {t("waterLog.amountLabel")}
            </span>
            <span className="hf-type-title hf-water-amount__value text-hf-black">{amountMl} ml</span>
          </div>
          <HfSlider
            largeOnWeb
            min={MIN_ML}
            max={Math.max(MAX_ML, amountMl)}
            step={STEP_ML}
            value={amountMl}
            onChange={(value) => {
              setAmountMl(value);
              setSelectedKey(null);
              setSaved(false);
            }}
            aria-label={t("waterLog.amountLabel")}
          />

          {saveError && <p className="hf-type-caption text-center">{saveError}</p>}
          {saved && !saveError && (
            <p className="hf-type-small hf-type-strong text-center text-hf-green">{t("waterLog.saved")}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || amountMl <= 0}
            className="hf-control hf-btn-primary"
          >
            <span className="hf-type-button">{saving ? t("waterLog.saving") : t("waterLog.add")}</span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {!loading && entries.length > 0 && (
            <p className="hf-type-caption px-1">{t("waterLog.recentTitle")}</p>
          )}
          {loading && (
            <SkeletonScreen className="flex flex-col gap-2">
              <SkeletonSectionTitle />
              <SkeletonCards count={3} height={48} radius={16} />
            </SkeletonScreen>
          )}
          {!loading && entries.length === 0 && (
            <p className="hf-type-caption text-center">{t("waterLog.noEntriesYet")}</p>
          )}
          {entries.length > 0 &&
            // Den fælles kortliste med datooverskrifter (som "Dine indscanninger").
            groupByDate(entries).map((group) => (
              <ItemListSection
                key={group.key}
                heading={dayHeadingLabel(group.date, intlLocale(locale), {
                  today: t("myScans.today"),
                  yesterday: t("myScans.yesterday"),
                })}
              >
                {group.entries.map((entry) => (
                  <ItemListRow key={entry.id} padded={false}>
                    <SwipeableRow onDelete={() => setConfirmDelete(entry)}>
                      <FoodRow
                        thumbnail={<IconWaterGlass size={22} stroke={1.75} className="text-hf-black" />}
                        title={`${entry.amountMl} ml`}
                        right={
                          <span className="hf-type-caption">
                            {t("common.clockPrefix")} {formatTime(entry.loggedAt)}
                          </span>
                        }
                      />
                    </SwipeableRow>
                  </ItemListRow>
                ))}
              </ItemListSection>
            ))}
        </div>
      </div>
      {confirmDelete && (
        <EntryDetailsSheet
          title={t("calendar.waterTitle")}
          subtitle={`${t("common.clockPrefix")} ${formatTime(confirmDelete.loggedAt)}`}
          rows={[{ label: t("entrySheet.amount"), value: `${confirmDelete.amountMl} ml` }]}
          onDelete={() => void deleteEntry(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </HfScreen>
  );
}

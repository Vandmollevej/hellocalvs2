"use client";

import { useEffect, useState } from "react";
import { IconDroplet } from "@tabler/icons-react";
import { FoodRow } from "@/components/FoodRow";
import { HfScreen } from "@/components/HfScreen";
import { HfSlider } from "@/components/hf/HfSlider";
import { SectionSeparator } from "@/components/hf/SectionSeparator";
import {
  IconBottleLarge,
  IconBottleSmall,
  IconGlassLarge,
  IconGlassSmall,
} from "@/components/icons/WaterContainers";
import { useTranslation } from "@/i18n/LocaleProvider";
import { localApi } from "@/lib/vault/local-api";

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
// freely adjustable afterwards for a manual amount.
const CONTAINERS = [
  { key: "bottleLarge", ml: 750, Icon: IconBottleLarge },
  { key: "bottleSmall", ml: 500, Icon: IconBottleSmall },
  { key: "glassLarge", ml: 500, Icon: IconGlassLarge },
  { key: "glassSmall", ml: 250, Icon: IconGlassSmall },
] as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}),
  }).format(date);
}

function localDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Newest first; entries from the same calendar day share one date separator.
function groupByDate(entries: WaterEntry[]) {
  const sorted = [...entries].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  const groups: { key: string; label: string; entries: WaterEntry[] }[] = [];
  for (const entry of sorted) {
    const key = localDateKey(entry.loggedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, label: formatDateLabel(entry.loggedAt), entries: [entry] });
  }
  return groups;
}

export default function WaterCreatePage() {
  const { t } = useTranslation();
  const [amountMl, setAmountMl] = useState(250);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    localApi("/api/water-entries")
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
      const response = await localApi("/api/water-entries", {
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
    <HfScreen title={t("waterLog.title")} icon={<IconDroplet size={20} stroke={2} />}>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("waterLog.intro")}</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {CONTAINERS.map(({ key, ml, Icon }) => {
            const isSelected = selectedKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickContainer(key, ml)}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl transition-colors"
                style={{
                  background: isSelected ? "var(--hf-green)" : "var(--hf-tan)",
                }}
              >
                <Icon size={28} stroke={1.75} color={isSelected ? "var(--hf-white)" : "var(--hf-black)"} />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: isSelected ? "var(--hf-white)" : "var(--hf-black)" }}
                >
                  {ml} ml
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-hf-black">{t("waterLog.amountLabel")}</span>
            <span className="text-[20px] font-bold text-hf-black">{amountMl} ml</span>
          </div>
          <HfSlider
            min={MIN_ML}
            max={MAX_ML}
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
            <p className="text-center text-[13px] font-semibold text-hf-green">{t("waterLog.saved")}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || amountMl <= 0}
            className="hf-btn-primary h-12 disabled:opacity-40"
          >
            <span className="hf-type-button">{saving ? t("waterLog.saving") : t("waterLog.add")}</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {!loading && entries.length > 0 && (
            <p className="hf-type-caption px-1">{t("waterLog.recentTitle")}</p>
          )}
          {loading && <p className="text-center text-[13px] text-hf-black opacity-60">{t("waterLog.loading")}</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-[13px] text-hf-black opacity-60">{t("waterLog.noEntriesYet")}</p>
          )}
          {groupByDate(entries).map((group) => (
            <div key={group.key}>
              <SectionSeparator label={group.label} className="my-2" />
              <ul>
                {group.entries.map((entry, i) => (
                  <li
                    key={entry.id}
                    className={i < group.entries.length - 1 ? "border-b border-hf-tan-dark" : ""}
                  >
                    <FoodRow
                      thumbnail={<IconDroplet size={22} stroke={1.75} className="text-hf-black" />}
                      title={`${entry.amountMl} ml`}
                      right={
                        <span className="text-xs text-hf-black opacity-60">
                          {t("common.clockPrefix")} {formatTime(entry.loggedAt)}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </HfScreen>
  );
}

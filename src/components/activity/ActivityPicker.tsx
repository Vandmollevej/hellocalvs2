"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { HfChevron } from "@/components/hf/HfChevron";
import { IconFavorite, IconFavoriteFilled } from "@/components/icons/Favorite";
import { getSportMeta } from "@/lib/sport-icons";
import type { ActivityOption } from "@/lib/activity-types";
import { useTranslation } from "@/i18n/LocaleProvider";

// Søgefelt blandt aktiviteter + "Tilføj … som aktivitet" (docs/DECISIONS.md
// 2026-09-29). Bruges af /activity/create og pulsudsvings-spørgsmålet.
export function ActivityPicker({ onPick, busy }: { onPick: (option: ActivityOption) => void; busy?: boolean }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/activity-types")
      .then((res) => (res.ok ? (res.json() as Promise<{ options: ActivityOption[] }>) : { options: [] }))
      .then((data) => setOptions(data.options))
      .catch(() => setOptions([]));
    fetch("/api/activity-favorites")
      .then((res) => (res.ok ? (res.json() as Promise<{ keys: string[] }>) : { keys: [] }))
      .then((data) => setFavoriteKeys(data.keys))
      .catch(() => setFavoriteKeys([]));
  }, []);

  function toggleFavorite(key: string, next: boolean) {
    setFavoriteKeys((current) => (next ? [...current.filter((k) => k !== key), key] : current.filter((k) => k !== key)));
    fetch("/api/activity-favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }).catch(() => {});
  }

  const trimmed = query.trim();
  const matches = useMemo(() => {
    const needle = trimmed.toLowerCase();
    if (!needle) return options;
    // Navnet først, derefter synonymer (fx "spinning" → Spinning, "judo" → Kampsport).
    const byLabel = options.filter((option) => option.label.toLowerCase().includes(needle));
    const byWord = options.filter(
      (option) => !byLabel.includes(option) && option.words?.some((word) => word.toLowerCase().includes(needle)),
    );
    return [...byLabel, ...byWord];
  }, [options, trimmed]);
  const exact = options.some((option) => option.label.toLowerCase() === trimmed.toLowerCase());

  async function addManual() {
    setAdding(true);
    try {
      const res = await fetch("/api/activity-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) return;
      const { option } = (await res.json()) as { option: ActivityOption };
      onPick(option);
    } finally {
      setAdding(false);
    }
  }

  const favoriteSet = new Set(favoriteKeys);
  // Uden søgning: favoritter øverst under egen overskrift, resten under "Alle aktiviteter".
  const showFavorites = !trimmed && options.some((option) => favoriteSet.has(option.key));
  const favoriteOptions = showFavorites ? options.filter((option) => favoriteSet.has(option.key)) : [];
  const listed = showFavorites ? matches.filter((option) => !favoriteSet.has(option.key)) : matches;

  function renderRows(list: ActivityOption[], extra?: { label: string; onClick: () => void }) {
    const disabled = busy || adding;
    const total = list.length + (extra ? 1 : 0);
    const rowClass = (index: number) =>
      `flex h-12 w-full items-center gap-4 px-4 text-left ${index < total - 1 ? "border-b border-hf-tan-dark" : ""}`;
    return (
      <AccordionCard>
        {list.map((option, index) => {
          const Icon = getSportMeta(option.key).icon;
          const isFavorite = favoriteSet.has(option.key);
          return (
            <div key={option.key} className={rowClass(index)}>
              <button
                type="button"
                onClick={disabled ? undefined : () => onPick(option)}
                className="flex h-full min-w-0 flex-1 items-center gap-4 text-left"
              >
                <span className="flex h-5 w-5 items-center justify-center text-hf-black">
                  <Icon size={20} />
                </span>
                <span className="hf-type-body flex-1 truncate">
                  {option.pending ? `${option.label} (${t("activity.pending")})` : option.label}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(option.key, !isFavorite)}
                aria-label={t(isFavorite ? "activity.removeFavorite" : "activity.addFavorite")}
                className="text-hf-green"
              >
                {isFavorite ? <IconFavoriteFilled size={20} /> : <IconFavorite size={20} />}
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={disabled ? undefined : () => onPick(option)}
              >
                <HfChevron className="text-hf-black" />
              </button>
            </div>
          );
        })}
        {extra && (
          <button type="button" onClick={disabled ? undefined : extra.onClick} className={rowClass(total - 1)}>
            <span className="flex h-5 w-5 items-center justify-center text-hf-black">
              <IconPlus size={20} />
            </span>
            <span className="hf-type-body flex-1 truncate">{extra.label}</span>
            <HfChevron className="text-hf-black" />
          </button>
        )}
      </AccordionCard>
    );
  }

  const showAdd = trimmed.length >= 2 && !exact;

  return (
    <div className="flex flex-col gap-4" aria-busy={busy || adding}>
      <div className="hf-search">
        <IconSearch size={16} color="var(--hf-black)" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("activity.searchPlaceholder")}
          aria-label={t("activity.searchPlaceholder")}
        />
      </div>
      {showFavorites && (
        <>
          <p className="hf-type-small hf-type-strong text-hf-black">{t("activity.favorites")}</p>
          {renderRows(favoriteOptions)}
          {listed.length > 0 && <p className="hf-type-small hf-type-strong text-hf-black">{t("activity.allActivities")}</p>}
        </>
      )}
      {(listed.length > 0 || showAdd) &&
        renderRows(listed, showAdd ? { label: t("activity.addManual", { name: trimmed }), onClick: () => void addManual() } : undefined)}
    </div>
  );
}

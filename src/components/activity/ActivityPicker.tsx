"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
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

  useEffect(() => {
    fetch("/api/activity-types")
      .then((res) => (res.ok ? (res.json() as Promise<{ options: ActivityOption[] }>) : { options: [] }))
      .then((data) => setOptions(data.options))
      .catch(() => setOptions([]));
  }, []);

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

  async function toggleFavorite(option: ActivityOption) {
    const next = !option.favorite;
    const apply = (value: boolean) =>
      setOptions((current) => {
        const updated = current.map((item) => (item.key === option.key ? { ...item, favorite: value } : item));
        return [...updated.filter((item) => item.favorite), ...updated.filter((item) => !item.favorite)];
      });
    apply(next);
    try {
      const res = await fetch("/api/activity-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: option.key, favorite: next }),
      });
      if (!res.ok) apply(!next);
    } catch {
      apply(!next);
    }
  }

  const rows = [
    ...matches.map((option) => {
      const Icon = getSportMeta(option.key).icon;
      return {
        key: option.key,
        icon: <Icon size={20} />,
        label: option.pending ? `${option.label} (${t("activity.pending")})` : option.label,
        onClick: () => onPick(option),
        favorite: option.favorite === true,
        onToggleFavorite: () => void toggleFavorite(option),
      };
    }),
    ...(trimmed.length >= 2 && !exact
      ? [
          {
            key: "__add",
            icon: <IconPlus size={20} />,
            label: t("activity.addManual", { name: trimmed }),
            onClick: () => void addManual(),
            favorite: undefined as boolean | undefined,
            onToggleFavorite: undefined as (() => void) | undefined,
          },
        ]
      : []),
  ];

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
      {rows.length > 0 && (
        <AccordionCard>
          {rows.map((row, index) => (
            <ChevronRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              onClick={busy || adding ? undefined : row.onClick}
              divider={index < rows.length - 1}
              trailing={
                row.onToggleFavorite ? (
                  <button
                    type="button"
                    onClick={row.onToggleFavorite}
                    aria-label={t(row.favorite ? "search.removeFavorite" : "search.addFavorite")}
                    className="flex h-12 items-center pl-1 pr-4 text-hf-green"
                  >
                    {row.favorite ? <IconFavoriteFilled size={20} /> : <IconFavorite size={20} />}
                  </button>
                ) : undefined
              }
            />
          ))}
        </AccordionCard>
      )}
    </div>
  );
}

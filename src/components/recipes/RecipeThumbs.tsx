"use client";

import { useEffect, useState } from "react";
import { IconThumbDown, IconThumbDownFilled, IconThumbUp, IconThumbUpFilled } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

// Tommel op/ned på en opskrift, i samme stil som HelloFresh-visningens
// outline-knapper (.rv-outline-button: 40 px, 1 px kant i aktionsfarven,
// radius 8). Valget gemmes pr. bruger; tryk igen fjerner det.
export function RecipeThumbs({ recipeKey }: { recipeKey: string }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(0);

  useEffect(() => {
    fetch(`/api/recipe-ratings?key=${encodeURIComponent(recipeKey)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { value: number }).value : 0))
      .then(setValue)
      .catch(() => setValue(0));
  }, [recipeKey]);

  async function rate(next: 1 | -1) {
    const previous = value;
    const target = value === next ? 0 : next;
    setValue(target);
    const res = await fetch("/api/recipe-ratings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: recipeKey, value: target }),
    }).catch(() => null);
    if (!res?.ok) setValue(previous);
  }

  const base =
    "inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--hf-color-action)] text-[var(--hf-color-action)] active:bg-[var(--hf-color-secondary-hover)]";
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void rate(1)} aria-pressed={value === 1} aria-label={t("recipeDetail.thumbUp")} className={base}>
        {value === 1 ? <IconThumbUpFilled size={22} /> : <IconThumbUp size={22} stroke={2} />}
      </button>
      <button type="button" onClick={() => void rate(-1)} aria-pressed={value === -1} aria-label={t("recipeDetail.thumbDown")} className={base}>
        {value === -1 ? <IconThumbDownFilled size={22} /> : <IconThumbDown size={22} stroke={2} />}
      </button>
    </div>
  );
}

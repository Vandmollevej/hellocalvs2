"use client";

import { useEffect, useState } from "react";
import { IconThumbDown, IconThumbDownFilled, IconThumbUp, IconThumbUpFilled } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

// Thumbs op/ned under en ret. Et tryk på den valgte tommelfinger fjerner
// vurderingen igen. Tallene vises ikke, så ingen jagter point.
export function RecipeRatingButtons({ recipeId }: { recipeId: string }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<-1 | 0 | 1>(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recipe-ratings?recipeId=${encodeURIComponent(recipeId)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { value: -1 | 0 | 1 }) : null))
      .then((data) => {
        if (!cancelled && data) setValue(data.value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  async function choose(next: 1 | -1) {
    const previous = value;
    const target = previous === next ? 0 : next;
    setValue(target);
    const res = await fetch("/api/recipe-ratings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId, value: target }),
    }).catch(() => null);
    if (!res?.ok) setValue(previous);
  }

  const base = "flex h-12 w-12 items-center justify-center rounded-full bg-hf-tan text-hf-black";
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <p className="hf-type-body hf-type-strong text-hf-black">{t("recipeDetail.rateTitle")}</p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => choose(-1)}
          aria-pressed={value === -1}
          aria-label={t("recipeDetail.thumbDown")}
          className={base}
        >
          {value === -1 ? <IconThumbDownFilled size={24} /> : <IconThumbDown size={24} />}
        </button>
        <button
          type="button"
          onClick={() => choose(1)}
          aria-pressed={value === 1}
          aria-label={t("recipeDetail.thumbUp")}
          className={base}
        >
          {value === 1 ? <IconThumbUpFilled size={24} /> : <IconThumbUp size={24} />}
        </button>
      </div>
    </div>
  );
}

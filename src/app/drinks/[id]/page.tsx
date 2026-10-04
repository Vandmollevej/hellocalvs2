"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { IconGlassCocktail } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { HfSlider } from "@/components/hf/HfSlider";
import { Skeleton } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { drinkTotals, type DrinkDto } from "@/lib/drinks";

function formatAmount(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(value);
}

// design.md §6.11-mønstret: billede øverst i cirklen (som varesiden), derefter
// ÉN skyder pr. ingrediens i drinken. Skyderne starter på regnearkets
// standardmængde (DrinkIngredient.defaultAmount).
function DrinkContent() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drink, setDrink] = useState<DrinkDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drinks")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { drinks: DrinkDto[] };
      })
      .then((data) => {
        const found = data.drinks.find((candidate) => candidate.id === id) ?? null;
        setDrink(found);
        if (found) {
          setAmounts(Object.fromEntries(found.ingredients.map((i) => [i.id, i.defaultAmount])));
        }
      })
      .catch(() => setDrink(null))
      .finally(() => setLoading(false));
  }, [id]);

  const totals = useMemo(
    () =>
      drink
        ? drinkTotals(drink.ingredients.map((ingredient) => ({ ingredient, amount: amounts[ingredient.id] ?? 0 })))
        : null,
    [drink, amounts]
  );
  const hasAmount = Object.values(amounts).some((value) => value > 0);

  async function handleSubmit() {
    if (!drink || !hasAmount) return;
    setSaving(true);
    setSaveError(null);
    try {
      const date = searchParams.get("date");
      const time = searchParams.get("time");
      const createdAt = date || time ? new Date(`${date ?? new Date().toLocaleDateString("sv-SE")}T${time ?? "12:00"}`) : null;
      const response = await fetch("/api/drinks/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drinkId: drink.id,
          amounts,
          ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt: createdAt.toISOString() } : {}),
        }),
      });
      if (!response.ok) {
        setSaveError(t("drinks.saveError"));
        return;
      }
      if (window.history.length > 1) router.back();
      else router.push("/");
    } catch {
      setSaveError(t("drinks.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title={drink?.name ?? t("drinks.title")} icon={<IconGlassCocktail size={20} stroke={2} />}>
      <div className="hf-page">
        {loading && <Skeleton width={180} height={180} className="self-center" style={{ borderRadius: "50%" }} />}
        {!loading && !drink && (
          <p className="hf-type-small text-text-secondary text-center">{t("drinks.notFound")}</p>
        )}
        {drink && (
          <>
            <div className="flex h-[180px] w-[180px] min-h-[180px] min-w-[180px] items-center justify-center self-center overflow-hidden rounded-full bg-hf-tan">
              {drink.imageUrl ? (
                <Image src={drink.imageUrl} alt={drink.name} width={180} height={180} className="h-full w-full object-cover" />
              ) : (
                <IconGlassCocktail size={72} stroke={1.25} className="text-hf-black" />
              )}
            </div>

            {drink.ingredients.map((ingredient) => (
              <div key={ingredient.id} className="flex flex-col gap-4 rounded-2xl bg-hf-tan p-4">
                <div className="flex items-baseline justify-between">
                  <span className="hf-type-small hf-type-strong text-hf-black">{ingredient.name}</span>
                  <span className="hf-type-title text-hf-black">
                    {formatAmount(amounts[ingredient.id] ?? 0)} {ingredient.unit}
                  </span>
                </div>
                <HfSlider
                  min={ingredient.minAmount}
                  max={ingredient.maxAmount}
                  step={ingredient.step}
                  value={amounts[ingredient.id] ?? 0}
                  onChange={(value) => setAmounts((current) => ({ ...current, [ingredient.id]: value }))}
                  aria-label={ingredient.name}
                />
              </div>
            ))}

            {totals && (
              <p className="hf-type-small text-text-secondary text-center">
                {t("drinks.kcalTotal", { kcal: Math.round(totals.kcal) })}
              </p>
            )}
            {saveError && <p className="hf-type-caption text-center">{saveError}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !hasAmount}
              className="hf-control hf-btn-primary disabled:opacity-40"
            >
              <span className="hf-type-button">{saving ? t("drinks.saving") : t("drinks.add")}</span>
            </button>
          </>
        )}
      </div>
    </HfScreen>
  );
}

export default function DrinkPage() {
  return (
    <Suspense fallback={null}>
      <DrinkContent />
    </Suspense>
  );
}

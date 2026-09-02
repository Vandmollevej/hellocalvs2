"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBarcode, IconCamera, IconHandClick, IconX, IconSoup } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import {
  readDishDraft,
  removeDishDraftIngredient,
  clearDishDraft,
  type DishDraftIngredient,
} from "@/lib/dish-draft";

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default function CreateDishPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<DishDraftIngredient[]>(readDishDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      ingredients.reduce(
        (acc, ingredient) => {
          const factor = ingredient.grams / 100;
          acc.grams += ingredient.grams;
          acc.kcal += ingredient.kcalPer100g * factor;
          acc.protein += ingredient.proteinPer100g * factor;
          acc.carbs += ingredient.carbsPer100g * factor;
          acc.fat += ingredient.fatPer100g * factor;
          return acc;
        },
        { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [ingredients]
  );

  function handleRemove(index: number) {
    removeDishDraftIngredient(index);
    setIngredients(readDishDraft());
  }

  async function handleSave() {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError("Giv retten et navn");
      return;
    }
    if (ingredients.length === 0) {
      setSaveError("Tilføj mindst én ingrediens");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ingredients: ingredients.map((i) => ({ productId: i.productId, grams: i.grams })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.message ?? "Kunne ikke gemme retten");
        return;
      }
      clearDishDraft();
      router.push("/foods");
    } catch {
      setSaveError("Kunne ikke gemme retten");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen
      title="Opret egen ret"
      icon={<IconSoup size={20} stroke={2} />}
      footer={
        <>
          {saveError && (
            <p className="mb-2 text-center text-sm text-hf-black opacity-70">{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-60"
          >
            {saving ? "Gemmer..." : "Gem ret"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          aria-label="Rettens navn"
          placeholder="Navn på retten"
          className="min-w-0 rounded-full bg-hf-tan px-4 py-2.5 text-sm text-hf-black outline-none"
        />

        <div>
          <p className="mb-2 text-xs font-bold text-hf-black">Ingredienser</p>
          {ingredients.length === 0 ? (
            <div className="rounded-2xl bg-hf-tan p-4 text-center">
              <p className="text-sm text-hf-black opacity-60">Ingen ingredienser endnu</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-hf-tan">
              {ingredients.map((ingredient, index) => (
                <div
                  key={`${ingredient.productId}-${index}`}
                  className="flex items-center gap-2.5 border-b border-hf-tan-dark px-4 py-3 last:border-b-0"
                >
                  <div className="h-9 w-9 flex-shrink-0">
                    {ingredient.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ingredient.imageUrl} alt="" className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-hf-black">{ingredient.name}</p>
                    <p className="text-xs text-hf-black opacity-60">
                      {ingredient.grams} g · {round((ingredient.kcalPer100g * ingredient.grams) / 100)} kcal
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    aria-label="Fjern ingrediens"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-hf-white text-hf-black"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {ingredients.length > 0 && (
          <div className="rounded-2xl bg-hf-tan p-4">
            <p className="mb-1 text-xs font-bold text-hf-black">I alt</p>
            <p className="text-sm text-hf-black">
              {round(totals.grams)} g · {round(totals.kcal)} kcal
            </p>
            <p className="text-xs text-hf-black opacity-60">
              Protein {round(totals.protein, 1)} g · Kulhydrat {round(totals.carbs, 1)} g · Fedt{" "}
              {round(totals.fat, 1)} g
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold text-hf-black">Tilføj ingrediens</p>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="/search?for=ret"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center"
            >
              <IconBarcode size={20} color="var(--hf-black)" />
              <span className="text-xs font-medium text-hf-black">Søg</span>
            </a>
            <a
              href="/camera?mode=produkt&for=ret"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center"
            >
              <IconCamera size={20} color="var(--hf-black)" />
              <span className="text-xs font-medium text-hf-black">Scan</span>
            </a>
            <a
              href="/foods/new?for=ret"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center"
            >
              <IconHandClick size={20} color="var(--hf-black)" />
              <span className="text-xs font-medium text-hf-black">Manuelt</span>
            </a>
          </div>
        </div>

      </div>
    </HfScreen>
  );
}

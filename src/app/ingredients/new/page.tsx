"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconCarrot } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { ActionButton } from "@/components/hf/ActionButton";
import { appendDishDraftIngredient } from "@/lib/dish-draft";
import { useTranslation } from "@/i18n/LocaleProvider";
import { PRIVATE_INGREDIENT_PREFIX } from "@/lib/private-ingredient-ids";

// "Opret egen ingrediens" (docs/DECISIONS.md 2026-09-24). Kun et navn —
// næringsindholdet kender brugeren ikke. Fra Opret ret (?for=ret) angives
// også mængden, og ingrediensen lægges direkte i retten. ?use=<id> genbruger
// en allerede oprettet egen ingrediens (fra søgningen på Opret ret).
function NewIngredientContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  const useId = searchParams.get("use");
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("100");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!useId) return;
    fetch(`/api/private-ingredients/${encodeURIComponent(useId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ingredient) setName(data.ingredient.name);
        else setError(t("privateIngredients.notFound"));
      })
      .catch(() => setError(t("privateIngredients.notFound")));
  }, [useId, t]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    const amount = Number(grams.replace(",", "."));
    if (!trimmed) return setError(t("privateIngredients.nameRequired"));
    if (forDish && !(amount > 0)) return setError(t("privateIngredients.amountRequired"));

    setSaving(true);
    try {
      let id = useId;
      if (!id) {
        const res = await fetch("/api/private-ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ingredient) throw new Error(data.message);
        id = data.ingredient.id as string;
      }
      if (forDish) {
        appendDishDraftIngredient({
          productId: `${PRIVATE_INGREDIENT_PREFIX}${id}`,
          name: trimmed,
          imageUrl: null,
          kcalPer100g: 0,
          proteinPer100g: 0,
          carbsPer100g: 0,
          fatPer100g: 0,
          grams: amount,
        });
        router.push("/create-dish");
      } else {
        router.push("/ingredients");
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("privateIngredients.saveError"));
      setSaving(false);
    }
  }

  return (
    <HfScreen title={t("privateIngredients.title")} icon={<IconCarrot size={20} stroke={2} />}>
      <form onSubmit={handleSubmit} className="hf-page">
        <p className="text-[14px] text-hf-black">{t("privateIngredients.intro")}</p>
        <TextField
          variant="standard"
          label={t("privateIngredients.nameLabel")}
          placeholder={t("privateIngredients.namePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          autoComplete="off"
          readOnly={Boolean(useId)}
        />
        {forDish && (
          <TextField
            variant="standard"
            label={t("privateIngredients.amountLabel")}
            inputMode="decimal"
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
          />
        )}
        {error && <p className="text-[13px] text-hf-red-dark">{error}</p>}
        <ActionButton type="submit" disabled={saving} className="hf-type-button h-12 disabled:opacity-40">
          {saving
            ? t("privateIngredients.saving")
            : forDish
              ? t("privateIngredients.addToDish")
              : t("privateIngredients.create")}
        </ActionButton>
        <Link
          href="/ingredients"
          className="text-center text-xs font-medium text-hf-black underline underline-offset-2"
        >
          {t("privateIngredients.seeList")}
        </Link>
      </form>
    </HfScreen>
  );
}

export default function NewIngredientPage() {
  return (
    <Suspense fallback={null}>
      <NewIngredientContent />
    </Suspense>
  );
}

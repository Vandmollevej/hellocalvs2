"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconBasket, IconClockFilled, IconPrinter } from "@tabler/icons-react";
import { IconFavorite as IconBookmark, IconFavoriteFilled as IconBookmarkFilled } from "@/components/icons/Favorite";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatHfAmount, HF_RECIPE_MAX_PHOTOS, proteinRow, type HfRecipeView } from "@/lib/hellofresh-recipe";
import { RecipeThumbs } from "@/components/recipes/RecipeThumbs";
import { RecipeViewScreen } from "@/components/recipe-view/RecipeViewLayout";
import {
  RecipeAccordion,
  RecipeActions,
  RecipeAllergens,
  RecipeDescription,
  RecipeMeta,
  RecipeTags,
  RecipeTitle,
  type RecipeMetaItem,
} from "@/components/recipe-view/RecipeViewSections";
import {
  RecipeCookbookPhotos,
  RecipeIngredientList,
  RecipeNutritionTable,
  RecipeStepList,
} from "@/components/recipe-view/RecipeViewLists";
import { RecipeDifficultyIcon, RecipeHealthAppIcon, RecipeProteinIcon } from "@/components/recipe-view/RecipeIcons";
import { RecipeUnitToggle, type RecipeUnitMode } from "@/components/recipe-view/RecipeUnitToggle";
import { measureAsGramsText } from "@/lib/kitchen-conversions";
import type { MealKitKey } from "@/lib/meal-kit-providers";

// En HelloFresh-opskrift vist præcis som i HelloFresh-appen
// (docs/DECISIONS.md 2026-09-27). Måltidskasse-retter (HelloFresh, RetNemt,
// BetterFeast — DECISIONS 2026-10-10) bruger denne side; brugerens egne og
// delte retter vises stadig på /profile/recipes/[id]. BetterFeast er
// færdigretter: ingen fremgangsmåde, men varedeklaration og næring pr. 100 g.

type Sections = { ingredients: boolean; declaration: boolean; steps: boolean; nutrition: boolean; photos: boolean };

const NUTRITION_NOTES: Record<MealKitKey, string> = {
  hellofresh: "hfRecipe.nutritionNote",
  retnemt: "hfRecipe.nutritionNoteRetnemt",
  betterfeast: "hfRecipe.nutritionNoteBetterfeast",
};
const ALLERGEN_NOTES: Partial<Record<MealKitKey, string>> = {
  hellofresh: "hfRecipe.allergenNote",
  retnemt: "hfRecipe.allergenNoteRetnemt",
};

function amountText(amount: number | null, unit: string | null) {
  return [amount === null ? null : formatHfAmount(amount), unit].filter(Boolean).join(" ");
}

export default function HelloFreshRecipePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [recipe, setRecipe] = useState<HfRecipeView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [sections, setSections] = useState<Sections>({
    ingredients: true,
    declaration: true,
    steps: true,
    nutrition: false,
    photos: true,
  });
  // Mål (dl, spsk) som i opskriften, eller omregnet til gram (src/lib/kitchen-conversions.ts).
  const [unitMode, setUnitMode] = useState<RecipeUnitMode>("measures");

  useEffect(() => {
    fetch(`/api/hellofresh-recipes/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("missing");
        setRecipe(((await res.json()) as { recipe: HfRecipeView }).recipe);
        setState("ready");
      })
      .catch(() => setState("missing"));
  }, [id]);

  function toggle(section: keyof Sections) {
    setSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.replace("/profile/recipes");
  }

  async function share(data: ShareData) {
    if (!navigator.share) {
      setNotice(t("hfRecipe.shareUnsupported"));
      return;
    }
    await navigator.share(data).catch(() => undefined);
  }

  async function toggleFavorite() {
    if (!recipe) return;
    const next = !recipe.isFavorite;
    setRecipe({ ...recipe, isFavorite: next });
    const res = await fetch(`/api/hellofresh-recipes/${encodeURIComponent(id)}/favorite`, {
      method: next ? "POST" : "DELETE",
    }).catch(() => null);
    if (!res?.ok) {
      setRecipe((current) => (current ? { ...current, isFavorite: !next } : current));
      setNotice(t("hfRecipe.favoriteError"));
    }
  }

  async function addPhoto(image: string) {
    const res = await fetch(`/api/hellofresh-recipes/${encodeURIComponent(id)}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    }).catch(() => null);
    if (!res?.ok) {
      setNotice(t("hfRecipe.photoError"));
      return;
    }
    const { photo } = (await res.json()) as { photo: { id: string; image: string } };
    setRecipe((current) => (current ? { ...current, photos: [...current.photos, photo] } : current));
  }

  async function removePhoto(photoId: string) {
    setRecipe((current) => (current ? { ...current, photos: current.photos.filter((p) => p.id !== photoId) } : current));
    await fetch(`/api/hellofresh-recipes/${encodeURIComponent(id)}/photos?photoId=${encodeURIComponent(photoId)}`, {
      method: "DELETE",
    }).catch(() => null);
  }

  // "Lad os lave mad": fold fremgangsmåden ud og scroll ned til den.
  function startCooking() {
    setSections((current) => ({ ...current, steps: true }));
    requestAnimationFrame(() => {
      document.getElementById("rv-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Registrering af retten (tilberedt / til sundhedsapps via integrationerne).
  const registerHref = `/add/${encodeURIComponent(id)}`;

  const protein = recipe ? proteinRow(recipe) : null;
  const meta: RecipeMetaItem[] = recipe
    ? ([
        recipe.totalMinutes !== null && {
          key: "time",
          label: t("hfRecipe.totalTime"),
          icon: <IconClockFilled size={18} />,
          value: t("hfRecipe.minutes", { minutes: recipe.totalMinutes }),
        },
        protein && {
          key: "protein",
          label: t("hfRecipe.protein"),
          icon: <RecipeProteinIcon />,
          value: amountText(protein.amount, protein.unit),
        },
        recipe.difficulty !== null && {
          key: "difficulty",
          label: t("hfRecipe.difficulty"),
          icon: <RecipeDifficultyIcon level={recipe.difficulty} />,
          value: t(`hfRecipe.difficulties.${recipe.difficulty}`),
        },
      ] as (RecipeMetaItem | false | null)[]).filter((item): item is RecipeMetaItem => Boolean(item))
    : [];

  // Udbyderens egne noter: HelloFreshs anlægsnote, RetNemts "vejledende".
  const allergenNote = recipe && ALLERGEN_NOTES[recipe.provider] ? t(ALLERGEN_NOTES[recipe.provider]!) : undefined;

  const allergenNames = recipe
    ? recipe.allergenNames.length
      ? recipe.allergenNames
      : recipe.allergenKeys.map((key) => t(`recipeFilters.allergens.${key}`))
    : [];

  function shareShoppingList() {
    if (!recipe) return;
    const lines = recipe.ingredients.map((i) => `• ${i.name}${amountText(i.amount, i.unit) ? ` (${amountText(i.amount, i.unit)})` : ""}`);
    const title = t("hfRecipe.shoppingListTitle", { name: recipe.name });
    void share({ title, text: `${title}\n\n${lines.join("\n")}` });
  }

  return (
    <RecipeViewScreen
      imageUrl={recipe?.imageUrl ?? null}
      backLabel={t("common.back")}
      shareLabel={t("hfRecipe.share")}
      onBack={goBack}
      onShare={recipe ? () => void share({ title: recipe.name, url: window.location.href }) : undefined}
      scrollRef={scrollRef}
      footer={
        state === "ready" && recipe ? (
          recipe.steps.length > 0 ? (
            <button type="button" className="rv-primary-button" onClick={startCooking}>
              {t("hfRecipe.letsCook")}
            </button>
          ) : (
            // Færdigret uden fremgangsmåde (BetterFeast): registrér direkte.
            <button type="button" className="rv-primary-button" onClick={() => router.push(registerHref)}>
              {t("hfRecipe.register")}
            </button>
          )
        ) : undefined
      }
    >
      {state === "loading" && <p className="rv-status">{t("hfRecipe.loading")}</p>}
      {state === "missing" && <p className="rv-status">{t("hfRecipe.notFound")}</p>}

      {state === "ready" && recipe && (
        <>
          {notice && <p className="rv-notice">{notice}</p>}
          <RecipeTitle name={recipe.name} headline={recipe.headline} />
          <RecipeMeta items={meta} />
          <RecipeTags tags={recipe.tags} />

          <RecipeActions>
            <button type="button" className="rv-outline-button rv-outline-button--save" onClick={toggleFavorite} aria-pressed={recipe.isFavorite}>
              {recipe.isFavorite ? <IconBookmarkFilled size={22} /> : <IconBookmark size={22} stroke={2} />}
              {t(recipe.isFavorite ? "hfRecipe.saved" : "hfRecipe.save")}
            </button>
            {recipe.ingredients.length > 0 && (
              <button type="button" className="rv-outline-button rv-outline-button--icon" onClick={shareShoppingList} aria-label={t("hfRecipe.shoppingList")}>
                <IconBasket size={22} stroke={2} />
              </button>
            )}
            <button type="button" className="rv-outline-button rv-outline-button--icon" onClick={() => window.print()} aria-label={t("hfRecipe.print")}>
              <IconPrinter size={22} stroke={2} />
            </button>
          </RecipeActions>
          <div className="rv-no-print">
            <RecipeThumbs recipeKey={`hf:${id}`} />
          </div>

          {recipe.description && (
            <RecipeDescription
              title={t("hfRecipe.description")}
              text={recipe.description}
              readMore={t("hfRecipe.readMore")}
              readLess={t("hfRecipe.readLess")}
            />
          )}
          <RecipeAllergens label={t("hfRecipe.allergens")} names={allergenNames} note={allergenNote} />

          {recipe.declaration && (
            <RecipeAccordion title={t("hfRecipe.declaration")} open={sections.declaration} onToggle={() => toggle("declaration")}>
              <p className="rv-declaration">{recipe.declaration}</p>
            </RecipeAccordion>
          )}

          {recipe.ingredients.length > 0 && (
          <RecipeAccordion title={t("hfRecipe.ingredients")} open={sections.ingredients} onToggle={() => toggle("ingredients")}>
            {recipe.ingredients.some((i) => measureAsGramsText(i.amount, i.unit, i.name) !== null) && (
              <div className="rv-no-print mb-3">
                <RecipeUnitToggle mode={unitMode} onChange={setUnitMode} />
              </div>
            )}
            <RecipeIngredientList
              items={recipe.ingredients.map((i) => ({
                key: i.key,
                name: i.name,
                amount:
                  (unitMode === "grams" ? measureAsGramsText(i.amount, i.unit, i.name) : null) ?? amountText(i.amount, i.unit),
                imageUrl: i.imageUrl,
              }))}
            />
          </RecipeAccordion>
          )}

          {recipe.steps.length > 0 && (
            <RecipeAccordion id="rv-steps" title={t("hfRecipe.steps")} open={sections.steps} onToggle={() => toggle("steps")}>
              <RecipeStepList steps={recipe.steps.map((step) => step.text)} />
              <button type="button" className="rv-outline-button rv-outline-button--block rv-no-print" onClick={() => router.push(registerHref)}>
                {t("hfRecipe.markCooked")}
              </button>
            </RecipeAccordion>
          )}

          {recipe.nutrition.length > 0 && (
            <RecipeAccordion
              title={t(recipe.nutritionBasis === "100g" ? "hfRecipe.nutritionPer100g" : "hfRecipe.nutrition")}
              open={sections.nutrition}
              onToggle={() => toggle("nutrition")}
            >
              <RecipeNutritionTable
                rows={recipe.nutrition.map((row, index) => ({
                  key: `${row.key ?? row.name}-${index}`,
                  label: row.name ?? t(`hfRecipe.nutrients.${row.key}`),
                  value: amountText(row.amount, row.unit),
                }))}
              />
              <p className="rv-nutrition-note">{t(NUTRITION_NOTES[recipe.provider])}</p>
              <button type="button" className="rv-outline-button rv-outline-button--block rv-no-print" onClick={() => router.push(registerHref)}>
                <RecipeHealthAppIcon />
                {t("hfRecipe.addToHealthApp")}
              </button>
            </RecipeAccordion>
          )}

          <div className="rv-no-print">
            <RecipeAccordion title={t("hfRecipe.cookbookPhotos")} open={sections.photos} onToggle={() => toggle("photos")}>
              <RecipeCookbookPhotos
                photos={recipe.photos}
                addLabel={t("hfRecipe.addPhoto")}
                removeLabel={t("hfRecipe.removePhoto")}
                canAdd={recipe.photos.length < HF_RECIPE_MAX_PHOTOS}
                onAdd={addPhoto}
                onRemove={removePhoto}
              />
            </RecipeAccordion>
          </div>
        </>
      )}
    </RecipeViewScreen>
  );
}

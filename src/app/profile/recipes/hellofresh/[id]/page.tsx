"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconBasket, IconClockFilled, IconPrinter } from "@tabler/icons-react";
import { IconFavorite as IconBookmark, IconFavoriteFilled as IconBookmarkFilled } from "@/components/icons/Favorite";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatHfAmount, HF_RECIPE_MAX_PHOTOS, proteinRow, type HfRecipeView } from "@/lib/hellofresh-recipe";
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

// En HelloFresh-opskrift vist præcis som i HelloFresh-appen
// (docs/DECISIONS.md 2026-09-27). Kun HelloFresh-opskrifter bruger denne
// side; brugerens egne og delte retter vises stadig på /profile/recipes/[id].

type Sections = { ingredients: boolean; steps: boolean; nutrition: boolean; photos: boolean };

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
  const [sections, setSections] = useState<Sections>({ ingredients: true, steps: true, nutrition: false, photos: true });

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
        state === "ready" ? (
          <button type="button" className="rv-primary-button" onClick={startCooking}>
            {t("hfRecipe.letsCook")}
          </button>
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
            <button type="button" className="rv-outline-button rv-outline-button--icon" onClick={shareShoppingList} aria-label={t("hfRecipe.shoppingList")}>
              <IconBasket size={22} stroke={2} />
            </button>
            <button type="button" className="rv-outline-button rv-outline-button--icon" onClick={() => window.print()} aria-label={t("hfRecipe.print")}>
              <IconPrinter size={22} stroke={2} />
            </button>
          </RecipeActions>

          {recipe.description && (
            <RecipeDescription
              title={t("hfRecipe.description")}
              text={recipe.description}
              readMore={t("hfRecipe.readMore")}
              readLess={t("hfRecipe.readLess")}
            />
          )}
          <RecipeAllergens label={t("hfRecipe.allergens")} names={allergenNames} note={t("hfRecipe.allergenNote")} />

          <RecipeAccordion title={t("hfRecipe.ingredients")} open={sections.ingredients} onToggle={() => toggle("ingredients")}>
            <RecipeIngredientList
              items={recipe.ingredients.map((i) => ({
                key: i.key,
                name: i.name,
                amount: amountText(i.amount, i.unit),
                imageUrl: i.imageUrl,
              }))}
            />
          </RecipeAccordion>

          <RecipeAccordion id="rv-steps" title={t("hfRecipe.steps")} open={sections.steps} onToggle={() => toggle("steps")}>
            <RecipeStepList steps={recipe.steps.map((step) => step.text)} />
            <button type="button" className="rv-outline-button rv-outline-button--block rv-no-print" onClick={() => router.push(registerHref)}>
              {t("hfRecipe.markCooked")}
            </button>
          </RecipeAccordion>

          {recipe.nutrition.length > 0 && (
            <RecipeAccordion title={t("hfRecipe.nutrition")} open={sections.nutrition} onToggle={() => toggle("nutrition")}>
              <RecipeNutritionTable
                rows={recipe.nutrition.map((row, index) => ({
                  key: `${row.key ?? row.name}-${index}`,
                  label: row.name ?? t(`hfRecipe.nutrients.${row.key}`),
                  value: amountText(row.amount, row.unit),
                }))}
              />
              <p className="rv-nutrition-note">{t("hfRecipe.nutritionNote")}</p>
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

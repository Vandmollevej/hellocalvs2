import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import { QualityControlTabs } from "@/components/admin/QualityControlTabs";
import { SharedRecipeReviewList, type SharedRecipeReviewRow } from "@/components/admin/SharedRecipeReviewList";
import { publisherPseudonym, type SharedIngredient } from "@/lib/shared-recipes";

// Kvalitetskontrol → Delte retter (docs/DECISIONS.md 2026-09-24). Nye delte
// retter er synlige med det samme og venter her på godkendelse. Anmeldte
// står øverst. Ejeren vises kun som pseudonym (GDPR, docs/PRIVACY.md).
export default async function AdminSharedRecipesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const recipes = await prisma.sharedRecipe.findMany({
    where: { status: "PENDING" },
    orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const rows: SharedRecipeReviewRow[] = recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    owner: publisherPseudonym(recipe.publisherHash),
    reportCount: recipe.reportCount,
    kcal: Math.round(recipe.kcal),
    ingredients: (recipe.ingredients as SharedIngredient[]).map((i) => `${i.name} (${Math.round(i.grams)} g)`),
    createdAt: recipe.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">{t(admin.locale, "quality_control_title")}</h1>
      <QualityControlTabs active="sharedRecipes" locale={admin.locale} />
      <p className="text-xs text-text-secondary">{t(admin.locale, "shared_recipes_hint")}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{t(admin.locale, "quality_control_empty")}</p>
      ) : (
        <SharedRecipeReviewList rows={rows} locale={admin.locale} />
      )}
    </div>
  );
}

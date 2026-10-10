import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { buildHfRecipeView, formatHfAmount } from "@/lib/hellofresh-recipe";
import { DISH_SOURCE_PATHS } from "@/lib/admin-dishes";
import { mealKitBySource } from "@/lib/meal-kit-providers";

// Admin → Retter → HelloFresh/RetNemt/BetterFeast → ret (docs/DECISIONS.md
// 2026-10-07 og 2026-10-10): kun visning. Måltidskassernes retter kan ikke
// redigeres og hører ikke under Varegodkendelse/Nye varer. Samme side
// bruges under /admin/dishes/retnemt/[id] og /admin/dishes/betterfeast/[id].

const NUTRIENT_LABELS: Record<string, string> = {
  kcal: "Energi",
  kj: "Energi",
  fat: "Fedt",
  saturatedFat: "Mættet fedt",
  carbs: "Kulhydrat",
  sugar: "Sukkerarter",
  fiber: "Kostfibre",
  protein: "Protein",
  salt: "Salt",
};

function amountText(amount: number | null, unit: string | null) {
  return [amount === null ? null : formatHfAmount(amount), unit].filter(Boolean).join(" ");
}

export default async function AdminMealKitDishPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      externalSource: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
      servingSizeGrams: true,
      allergens: true,
      nutritionExtra: true,
      recipeDetails: true,
      ingredients: {
        select: { rawAmount: true, rawUnit: true, ingredient: { select: { id: true, name: true, imageUrl: true } } },
      },
    },
  });
  const provider = mealKitBySource(product?.externalSource);
  if (!product || !provider) notFound();

  const view = buildHfRecipeView(product, { isFavorite: false, photos: [] });
  const meta = [
    view.totalMinutes ? `${view.totalMinutes} min.` : null,
    view.difficulty ? `Sværhedsgrad ${view.difficulty}` : null,
    view.tags.length ? view.tags.join(", ") : null,
  ].filter(Boolean);
  const allergens = view.allergenNames.length ? view.allergenNames : view.allergenKeys;

  return (
    <div className="flex flex-col gap-6">
      <Link href={DISH_SOURCE_PATHS[provider.source]} className="hf-type-small text-text-secondary hover:text-hf-black">
        ← {provider.name}-retter
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row">
        {view.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.imageUrl}
            alt=""
            className="aspect-[4/3] w-full shrink-0 rounded-md border border-hf-tan-dark object-cover sm:w-80"
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="hf-type-title text-hf-black">{view.name}</h1>
          {view.headline && <p className="hf-type-body text-text-secondary">{view.headline}</p>}
          {meta.length > 0 && <p className="hf-type-small text-text-secondary">{meta.join(" · ")}</p>}
          {view.description && <p className="hf-type-body text-hf-black">{view.description}</p>}
        </div>
      </div>

      <details className="hf-surface group">
        <summary className="hf-type-body hf-type-strong flex cursor-pointer list-none items-center justify-between px-4 py-3 text-hf-black">
          Indhold
          <span aria-hidden className="text-text-secondary transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-6 border-t border-hf-tan-dark px-4 py-4">
          {view.declaration && (
            <section className="flex flex-col gap-2">
              <h2 className="hf-type-body hf-type-strong text-hf-black">Varedeklaration</h2>
              <p className="hf-type-small text-hf-black">{view.declaration}</p>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="hf-type-body hf-type-strong text-hf-black">Ingredienser</h2>
            {view.ingredients.length === 0 ? (
              <p className="hf-type-small text-text-muted">Ingen ingredienser.</p>
            ) : (
              <ul className="divide-y divide-border-strong">
                {view.ingredients.map((item) => (
                  <li key={item.key} className="hf-type-small flex justify-between gap-4 py-1.5 text-hf-black">
                    <span>{item.name}</span>
                    <span className="shrink-0 text-text-secondary">{amountText(item.amount, item.unit)}</span>
                  </li>
                ))}
              </ul>
            )}
            {allergens.length > 0 && (
              <p className="hf-type-small text-text-secondary">Allergener: {allergens.join(", ")}</p>
            )}
          </section>

          {view.nutrition.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="hf-type-body hf-type-strong text-hf-black">
                Næringsværdier pr. {view.nutritionBasis === "100g" ? "100 g" : "portion"}
              </h2>
              <ul className="divide-y divide-border-strong">
                {view.nutrition.map((row, index) => (
                  <li key={`${row.name ?? row.key}-${index}`} className="hf-type-small flex justify-between gap-4 py-1.5 text-hf-black">
                    <span>{row.name ?? NUTRIENT_LABELS[row.key ?? ""] ?? row.key}</span>
                    <span className="shrink-0 text-text-secondary">{amountText(row.amount, row.unit)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.steps.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="hf-type-body hf-type-strong text-hf-black">Fremgangsmåde</h2>
              <ol className="flex list-decimal flex-col gap-2 pl-5">
                {view.steps.map((step, index) => (
                  <li key={index} className="hf-type-small text-hf-black">
                    {step.text}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </details>
    </div>
  );
}

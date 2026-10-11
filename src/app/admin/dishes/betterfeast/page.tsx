import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams, type DishSearchParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → BetterFeast (docs/DECISIONS.md 2026-10-10): kun visning
// og Deaktivér, som HelloFresh.
export default async function AdminBetterFeastDishesPage({
  searchParams,
}: {
  searchParams: Promise<DishSearchParams>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page, deleted, problem } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "BETTERFEAST", { deleted, problem });
  return (
    <DishListPage
      title="BetterFeast-retter"
      intro="Alle BetterFeast-færdigretter; det natlige job henter ugens menu og spærrer retter, der ikke har været på menuen i fire måneder. Markér rækker for at deaktivere, godkende, sende til gennemsyn eller slette."
      basePath="/admin/dishes/betterfeast"
      q={q}
      data={data}
      deleted={deleted}
      problem={problem}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen BetterFeast-retter er importeret endnu."}
    />
  );
}

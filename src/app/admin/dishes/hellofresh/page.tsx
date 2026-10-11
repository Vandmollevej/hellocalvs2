import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams, type DishSearchParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → HelloFresh (docs/DECISIONS.md 2026-09-28): alle
// HelloFresh-retter. De står ikke længere i Produkt-database.
export default async function AdminHelloFreshDishesPage({
  searchParams,
}: {
  searchParams: Promise<DishSearchParams>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page, deleted, problem } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "HELLOFRESH", { deleted, problem });
  return (
    <DishListPage
      title="HelloFresh-retter"
      intro="Alle retter fra HelloFresh-importen. Markér rækker for at deaktivere, godkende, sende til gennemsyn eller slette."
      basePath="/admin/dishes/hellofresh"
      q={q}
      data={data}
      deleted={deleted}
      problem={problem}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen HelloFresh-retter er importeret endnu."}
    />
  );
}
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → HelloFresh (docs/DECISIONS.md 2026-09-28): alle
// HelloFresh-retter. De står ikke længere i Produkt-database.
export default async function AdminHelloFreshDishesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "HELLOFRESH");
  return (
    <DishListPage
      title="HelloFresh-retter"
      intro="Alle retter fra HelloFresh-importen. Du kan kun deaktivere en ret."
      basePath="/admin/dishes/hellofresh"
      q={q}
      data={data}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen HelloFresh-retter er importeret endnu."}
    />
  );
}
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadHelloFreshDishes, parseDishParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";
import { setDishDisabled } from "../actions";

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
  const data = await loadHelloFreshDishes(q, page);
  return (
    <DishListPage
      title="HelloFresh-retter"
      intro="Alle retter fra HelloFresh-importen. Klik på en ret for at åbne den."
      basePath="/admin/dishes/hellofresh"
      q={q}
      data={data}
      empty={q ? "Ingen retter matcher søgningen." : "Ingen HelloFresh-retter er importeret endnu."}
      disableAction={setDishDisabled}
    />
  );
}
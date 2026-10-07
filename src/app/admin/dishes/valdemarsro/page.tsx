import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadHelloFreshDishes, parseDishParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";
import { setDishDisabled } from "../actions";

// Admin → Retter → Valdemarsro (docs/DECISIONS.md 2026-09-28). Retterne
// hentes hver nat af scripts/valdemarsro-agent; døde links spærres automatisk.
export default async function AdminValdemarsroDishesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page } = parseDishParams(await searchParams);
  const data = await loadHelloFreshDishes(q, page, "VALDEMARSRO");
  return (
    <DishListPage
      title="Valdemarsro-retter"
      intro="Retter fra Valdemarsro. Det natlige job finder nye retter og spærrer døde links."
      basePath="/admin/dishes/valdemarsro"
      q={q}
      data={data}
      empty={q ? "Ingen retter matcher søgningen." : "Ingen Valdemarsro-retter er importeret endnu."}
      disableAction={setDishDisabled}
    />
  );
}

import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadUserDishes, parseDishParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → Brugeroprettede (docs/DECISIONS.md 2026-09-28): de retter,
// brugerne har delt. Private retter vises aldrig (docs/PRIVACY.md).
export default async function AdminUserDishesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page } = parseDishParams(await searchParams);
  const data = await loadUserDishes(q, page);
  return (
    <DishListPage
      title="Brugeroprettede retter"
      intro="Retter, som brugerne har delt. Private retter i brugernes egne lister vises ikke her. Afventende retter godkendes under Kvalitetskontrol."
      basePath="/admin/dishes/user"
      q={q}
      data={data}
      empty={q ? "Ingen retter matcher søgningen." : "Ingen brugere har delt en ret endnu."}
    />
  );
}
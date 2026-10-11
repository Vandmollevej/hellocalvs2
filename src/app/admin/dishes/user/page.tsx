import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadUserDishes, parseDishParams, type DishSearchParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → Brugeroprettede (docs/DECISIONS.md 2026-09-28): de retter,
// brugerne har delt. Private retter vises aldrig (docs/PRIVACY.md).
export default async function AdminUserDishesPage({
  searchParams,
}: {
  searchParams: Promise<DishSearchParams>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page, deleted, problem } = parseDishParams(await searchParams);
  const data = await loadUserDishes(q, page, { deleted, problem });
  return (
    <DishListPage
      title="Brugeroprettede retter"
      intro="Retter, som brugerne har delt. Private retter i brugernes egne lister vises ikke her. Afventende retter godkendes under Kvalitetskontrol, eller her med Handlinger."
      basePath="/admin/dishes/user"
      q={q}
      data={data}
      deleted={deleted}
      problem={problem}
      empty={q ? "Ingen retter matcher søgningen." : "Ingen brugere har delt en ret endnu."}
    />
  );
}
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadFilterView } from "@/lib/pet-food-filter-admin";
import { PetFoodFilterEditor } from "@/components/admin/PetFoodFilterEditor";

// Admin → Indstillinger → Dyrefoder-filter (docs/PET-FOOD-FILTER.md, docs/DECISIONS.md 2026-10-07):
// se hele dyrefoder-filteret (stærke ord, mærker, svage ord, stregkoder), redigere det og afprøve det.
export default async function AdminPetFoodFilterPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const view = await loadFilterView();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Dyrefoder-filter</h1>
        <p className="hf-type-body text-text-secondary">
          Filteret afviser dyrefoder, når en bruger scanner eller opretter en vare: først stregkoden, så ordene i navn, mærke og
          ingredienser. Første forsøg giver brugeren en advarsel, andet spærrer kontoen. Hver afvisning vises i{" "}
          <Link href="/admin" className="text-hf-green-dark hover:underline">
            Oversigten
          </Link>{" "}
          til gennemsyn, og spærrede konti ligger under{" "}
          <Link href="/admin/users?show=blocked" className="text-hf-green-dark hover:underline">
            Brugere → Spærrede
          </Link>
          .
        </p>
        <p className="hf-type-small mt-2 text-text-muted">
          Dine ændringer lægges oven på standardlisterne (fra scrapingen af danske og tyske butikker) og virker inden for et minut.
          Standardlisterne ændres kun ved ny scraping. Fuld rapport: docs/PET-FOOD-FILTER.md.
        </p>
      </div>
      <PetFoodFilterEditor view={view} canEdit={admin.adminAccessLevel === "FULL"} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { listGenericProducts, parseListFilters, type GenericListFilters } from "@/lib/generic-product-admin";
import { GenericProductsAdmin } from "@/components/admin/GenericProductsAdmin";

// Admin → Varer → Generiske produkter (docs/DECISIONS.md 2026-10-15): opret
// manuelt, importér CSV/.xlsx (samme kolonner som "Generiske produkter.xlsx"),
// redigér og slet. Næring kopieres kun fra Frida (snapshot-princip).

const numberFormat = new Intl.NumberFormat("da-DK");

function hrefFor(filters: GenericListFilters, patch: Partial<GenericListFilters>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...patch })) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/admin/product-database/generics?${query}` : "/admin/product-database/generics";
}

export default async function AdminGenericProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const filters = parseListFilters(await searchParams);
  const [active, archived, first, categories] = await Promise.all([
    prisma.genericIngredient.count({ where: { archivedAt: null } }),
    prisma.genericIngredient.count({ where: { archivedAt: { not: null } } }),
    listGenericProducts(filters, 1),
    prisma.genericIngredient.findMany({
      where: { sheetCategory: { not: null } },
      distinct: ["sheetCategory"],
      select: { sheetCategory: true },
      orderBy: { sheetCategory: "asc" },
    }),
  ]);

  const tabClass = (on: boolean) =>
    `hf-type-body rounded-md px-3 py-1.5 ${on ? "bg-hf-green-dark text-hf-white" : "text-hf-black hover:bg-hf-tan"}`;
  const archivedView = filters.status === "archived";

  return (
    <div className="hf-admin-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="hf-type-title text-hf-black">Generiske produkter</h1>
          <p className="hf-type-body text-text-secondary">
            Varer uden stregkode og brand, fx æble, hakket oksekød og rugbrød. Opret én ad gangen, importér mange fra
            CSV/Excel, eller ret og slet. Næringstal kopieres kun fra Frida — aldrig skøn.
          </p>
        </div>
        <div className="hf-surface flex gap-1 p-1" role="group" aria-label="Aktive eller slettede">
          <Link href={hrefFor(filters, { status: "" })} className={tabClass(!archivedView)}>
            Aktive ({numberFormat.format(active)})
          </Link>
          <Link href={hrefFor(filters, { status: "archived" })} className={tabClass(archivedView)}>
            Slettede, men brugt ({numberFormat.format(archived)})
          </Link>
        </div>
      </div>

      <GenericProductsAdmin
        key={JSON.stringify(filters)}
        initial={first}
        categories={categories.flatMap((c) => (c.sheetCategory ? [c.sheetCategory] : []))}
        filters={filters}
      />
    </div>
  );
}

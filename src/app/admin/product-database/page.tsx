import { redirect } from "next/navigation";

// Produkt-database er en menugruppe med Produkter og Brands
// (docs/DECISIONS.md 2026-09-28); gamle links sender videre med filtrene.
export default async function AdminProductDatabaseRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const query = params.toString();
  redirect(query ? `/admin/product-database/products?${query}` : "/admin/product-database/products");
}

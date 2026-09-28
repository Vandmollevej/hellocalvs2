import { redirect } from "next/navigation";

// Den gamle søgeside er afløst af Produkt-database (docs/DECISIONS.md
// 2026-09-27); gamle links sender videre med søgeordet.
export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(q ? `/admin/product-database/products?q=${encodeURIComponent(q)}` : "/admin/product-database/products");
}

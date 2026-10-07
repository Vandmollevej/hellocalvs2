import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { getProductPageTagSettings, listProductKeywordCounts } from "@/lib/product-page-tags-settings";
import { ProductPageTagsEditor } from "@/components/admin/ProductPageTagsEditor";

// Admin "Varedatabase → Nøgleord" (docs/DECISIONS.md 2026-10-02 + 2026-10-07):
// vælg hvilke nøgleordstyper og -grupper der vises på produktsiden over
// "Energifordeling".
export default async function AdminProductPageTagsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const [settings, keywords] = await Promise.all([
    getProductPageTagSettings(),
    listProductKeywordCounts().catch((error) => {
      console.error("Failed to list product keywords", error);
      return [];
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Nøgleord på produktsiden</h1>
        <p className="hf-type-body text-text-secondary">
          Vælg hvilke typer og grupper af nøgleord der vises som en linje brødtekst lige over &quot;Energifordeling&quot;
          på produktsiden. Der vises kun det, varen faktisk har. Faste typer (fx Økologisk, Glutenfri) vises på
          brugerens sprog; nøgleord fra produktarkene vises som i arket (dansk).
        </p>
      </div>
      <ProductPageTagsEditor initialSettings={settings} keywords={keywords} />
    </div>
  );
}

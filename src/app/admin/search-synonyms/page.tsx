import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { SearchSynonymsEditor } from "@/components/admin/SearchSynonymsEditor";

export default async function AdminSearchSynonymsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const synonyms = await prisma.searchSynonym.findMany({ orderBy: [{ language: "asc" }, { termA: "asc" }] });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Synonymordbog</h1>
        <p className="hf-type-body text-text-secondary">
          Ord der betyder det samme i søgningen, fx &quot;gris&quot; og &quot;svin&quot;. Søger man på det ene ord,
          vises også varer med det andet. Procenten angiver, hvor ens ordene er: 100 % behandles som det samme
          ord, lavere tal rangerer synonym-træffene længere nede, og 0 % slår parret fra.
        </p>
      </div>
      <SearchSynonymsEditor
        initial={synonyms.map((s) => ({
          id: s.id,
          language: s.language,
          termA: s.termA,
          termB: s.termB,
          similarity: s.similarity,
        }))}
      />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ALLERGEN_CATALOG, labelForAllergen } from "@/lib/allergens";
import { addAllergenWord, decideAllergenWord } from "./actions";

// Admin → Allergen-ord (docs/DECISIONS.md 2026-10-17): rapporten fra nattens
// allergen-robot (job "allergen-words"). "Til gennemsyn" er ord, producenten
// har skrevet med STORT, men som opslagsværket ikke kender; "Godkendt" vises
// med STORT og link til allergenets side overalt i web og app.

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", status: "PENDING", label: "Til gennemsyn" },
  { key: "approved", status: "APPROVED", label: "Godkendt" },
  { key: "rejected", status: "REJECTED", label: "Afvist" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  reference: "Open Food Facts",
  uppercase: "Skrevet med STORT",
  admin: "Tilføjet af admin",
};

const dateFormat = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" });

function AllergenSelect({ value }: { value?: string | null }) {
  return (
    <select name="allergenKey" defaultValue={value ?? ""} className="hf-input" required>
      <option value="" disabled>
        Vælg allergen
      </option>
      {ALLERGEN_CATALOG.map((item) => (
        <option key={item.key} value={item.key}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

export default async function AdminAllergenWordsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const requested = (await searchParams).tab;
  const tab = TABS.find((item) => item.key === requested) ?? TABS[0];
  const canEdit = admin.adminAccessLevel === "FULL";

  const [groups, rows, job] = await Promise.all([
    prisma.allergenWord.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.allergenWord.findMany({
      where: { status: tab.status },
      orderBy: [{ productCount: "desc" }, { word: "asc" }],
      take: 300,
    }),
    prisma.scheduledJob.findUnique({ where: { key: "allergen-words" } }),
  ]);
  const counts = new Map(groups.map((group) => [group.status, group._count._all]));

  return (
    <div className="hf-admin-page">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-page-title text-hf-black">Allergen-ord</h1>
        <p className="hf-type-body text-text-secondary">
          Seneste kørsel:{" "}
          {job?.lastRunAt ? `${dateFormat.format(job.lastRunAt)} — ${job.lastMessage ?? job.lastStatus ?? ""}` : "ikke kørt endnu"}
          {" · "}
          <Link href="/admin/robots" className="hf-btn-text text-hf-green-dark">
            Plan og kør nu
          </Link>
        </p>
        <p className="hf-type-body text-text-secondary">
          Godkendte ord vises med STORT og fed i alle ingredienslister og linker til allergenets side under Viden om mad.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Status">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "pending" ? "/admin/allergen-words" : `/admin/allergen-words?tab=${item.key}`}
            aria-pressed={item.key === tab.key}
            className="hf-choice"
          >
            {item.label} ({counts.get(item.status) ?? 0})
          </Link>
        ))}
      </nav>

      {canEdit && (
        <form action={addAllergenWord} className="flex flex-wrap items-center gap-2">
          <input name="word" className="hf-input" placeholder="Nyt ord, fx kærnemælk" required />
          <AllergenSelect />
          <button type="submit" className="hf-btn hf-btn-primary">
            Tilføj ord
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen ord her.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="hf-type-body w-full text-left">
            <thead>
              <tr className="hf-table-section hf-type-small">
                <th className="py-2 pr-3">Ord</th>
                <th className="py-2 pr-3">Allergen</th>
                <th className="py-2 pr-3">Kilde</th>
                <th className="py-2 pr-3">Varer</th>
                <th className="py-2 pr-3">Eksempel</th>
                <th className="py-2 pr-3">Fundet</th>
                {canEdit && <th className="py-2 pr-3">Afgørelse</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.word} className="border-b border-hf-tan-dark align-top">
                  <td className="py-3 pr-3 hf-type-strong">{row.word.toUpperCase()}</td>
                  <td className="py-3 pr-3">{row.allergenKey ? labelForAllergen(row.allergenKey) : "—"}</td>
                  <td className="py-3 pr-3">
                    {SOURCE_LABELS[row.source] ?? row.source}
                    {row.language ? ` · ${row.language}` : ""}
                  </td>
                  <td className="py-3 pr-3">{row.productCount}</td>
                  <td className="py-3 pr-3">
                    {row.exampleProductId ? (
                      <Link href={`/admin/products/${row.exampleProductId}`} className="hf-btn-text text-hf-green-dark">
                        {row.exampleContext ?? "Vis vare"}
                      </Link>
                    ) : (
                      (row.exampleContext ?? "—")
                    )}
                  </td>
                  <td className="py-3 pr-3">{dateFormat.format(row.firstSeenAt)}</td>
                  {canEdit && (
                    <td className="py-3 pr-3">
                      <form action={decideAllergenWord} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="word" value={row.word} />
                        {tab.key !== "approved" && <AllergenSelect value={row.allergenKey} />}
                        {tab.key !== "approved" && (
                          <button type="submit" name="decision" value="approve" className="hf-btn hf-btn-primary">
                            Godkend
                          </button>
                        )}
                        {tab.key !== "rejected" && (
                          <button type="submit" name="decision" value="reject" formNoValidate className="hf-btn hf-btn-secondary">
                            Afvis
                          </button>
                        )}
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

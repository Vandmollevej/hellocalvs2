import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PendingImageCard } from "@/components/admin/PendingImageCard";
import { ClearForwardFlagButton } from "@/components/admin/ClearForwardFlagButton";
import { ProgressiveList } from "@/components/admin/ProgressiveList";
import { BulkActionsBar, BulkRow, BulkSelection } from "@/components/admin/BulkSelection";

// Possible duplicates: two products sharing the same name (case-insensitive)
// — the schema's Barcode.code is a primary key, so two products can never
// literally share one barcode row; a same-name pair is the closest real
// signal without a dedicated fuzzy-matching pipeline. Products that
// otherwise match but have differing macros/ingredients are flagged as a
// data conflict rather than a plain duplicate.
//
// Hastighed (docs/DECISIONS.md 2026-10-11): grupperingen sker i databasen og
// kun de første grupper hentes; før blev hele varekataloget læst ind og
// grupperet i hukommelsen ved hvert besøg.
const DUPLICATE_GROUP_LIMIT = 300;
const PENDING_IMAGE_LIMIT = 200;

async function findDuplicateGroups() {
  const [countRows, groupRows] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM (
        SELECT 1 FROM "products" WHERE "deletedAt" IS NULL GROUP BY lower(btrim(name)) HAVING count(*) > 1
      ) t`,
    prisma.$queryRaw<{ ids: string[] }[]>`
      SELECT array_agg(id ORDER BY "createdAt") AS ids FROM "products"
      WHERE "deletedAt" IS NULL
      GROUP BY lower(btrim(name)) HAVING count(*) > 1
      ORDER BY lower(btrim(name))
      LIMIT ${DUPLICATE_GROUP_LIMIT}`,
  ]);
  const products = await prisma.product.findMany({
    where: { id: { in: groupRows.flatMap((row) => row.ids) } },
    include: { brand: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const groups = groupRows
    .map((row) => row.ids.flatMap((id) => byId.get(id) ?? []))
    .filter((group) => group.length > 1);
  return { total: Number(countRows[0]?.n ?? 0), groups };
}

function macrosDiffer(a: { kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; ingredientsText: string | null }, b: typeof a) {
  return (
    a.kcalPer100g !== b.kcalPer100g ||
    a.proteinPer100g !== b.proteinPer100g ||
    a.carbsPer100g !== b.carbsPer100g ||
    a.fatPer100g !== b.fatPer100g ||
    (a.ingredientsText ?? "") !== (b.ingredientsText ?? "")
  );
}

// De tidligere "Advarsler"-sektioner (dubletter, billeder til godkendelse,
// videresend-misbrug). Siden "Advarsler" er erstattet af "Uncertainties"
// (docs/DECISIONS.md 2026-09-24), som viser dem under de fire faner.
export async function LegacyWarnings() {
  const [duplicates, pendingImages, pendingImageTotal, forwardAbuseUsers] = await Promise.all([
    findDuplicateGroups(),
    prisma.product.findMany({
      where: { imageStatus: "PENDING", deletedAt: null },
      include: { brand: true },
      orderBy: { createdAt: "asc" },
      take: PENDING_IMAGE_LIMIT,
    }),
    prisma.product.count({ where: { imageStatus: "PENDING", deletedAt: null } }),
    prisma.user.findMany({
      where: { forwardAbuseFlaggedAt: { not: null } },
      orderBy: { forwardAbuseFlaggedAt: "desc" },
      take: 200,
    }),
  ]);
  const duplicateGroups = duplicates.groups;
  // Markering (docs/DECISIONS.md 2026-10-11): varerne i dubletgrupperne og
  // billedforslagene kan behandles samlet.
  const productIds = [...new Set([...duplicateGroups.flat().map((p) => p.id), ...pendingImages.map((p) => p.id)])];

  return (
    <BulkSelection kind="product" ids={productIds}>
    <div className="flex flex-col gap-8">
      {productIds.length > 0 && <BulkActionsBar />}
      <section className="flex flex-col gap-4">
        <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">
          Mulige dubletter ({duplicates.total})
        </h2>
        {duplicateGroups.length === 0 ? (
          <p className="hf-type-body text-text-secondary">Ingen varer med samme navn fundet.</p>
        ) : (
          <ProgressiveList
            items={duplicateGroups.map((group) => {
              const conflict = group.some((p, i) => i > 0 && macrosDiffer(group[0], p));
              return (
                <div key={group[0].id} className="hf-panel">
                  <p className="hf-type-strong mb-2 flex items-center gap-2 text-hf-black">
                    {group[0].name}
                    {conflict && (
                      <span className="hf-badge hf-badge--danger">
                        Data matcher ikke
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col gap-2">
                    {group.map((p) => (
                      <BulkRow as="div" key={p.id} id={p.id} className="rounded-md">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="hf-type-body flex items-center justify-between rounded-md border border-hf-tan-dark px-3 py-2 hover:border-hf-green"
                        >
                          <span>
                            {p.brand?.name ? `${p.brand.name} · ` : ""}
                            {p.status} · {Math.round(p.kcalPer100g)} kalorier · Protein {p.proteinPer100g} g · Kulhydrat{" "}
                            {p.carbsPer100g} g · Fedt {p.fatPer100g} g
                          </span>
                          <span className="hf-type-small text-hf-green-dark underline">Åbn / merge</span>
                        </Link>
                      </BulkRow>
                    ))}
                  </div>
                </div>
              );
            })}
          />
        )}
        {duplicates.total > duplicateGroups.length && (
          <p className="hf-type-small text-text-muted">
            Viser de første {duplicateGroups.length} af {duplicates.total} grupper.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">
          Billeder til godkendelse ({pendingImageTotal})
        </h2>
        {pendingImages.length === 0 ? (
          <p className="hf-type-body text-text-secondary">Ingen billeder afventer godkendelse.</p>
        ) : (
          <ProgressiveList
            className="grid gap-4 sm:grid-cols-2"
            items={pendingImages.map((product) => (
              <BulkRow as="div" key={product.id} id={product.id} ignoreInteractive className="rounded-lg">
                <PendingImageCard product={product} />
              </BulkRow>
            ))}
          />
        )}
        {pendingImageTotal > pendingImages.length && (
          <p className="hf-type-small text-text-muted">
            Viser de ældste {pendingImages.length} af {pendingImageTotal} — godkend dem, så kommer de næste frem.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">
          Videresend-misbrug ({forwardAbuseUsers.length})
        </h2>
        <p className="hf-type-body text-text-secondary">
          Brugere flagget for mere end én tur-retur videresendelse med samme person på 24 timer.
          Flaget blokerer nye forward-points for brugeren, indtil det ryddes.
        </p>
        {forwardAbuseUsers.length === 0 ? (
          <p className="hf-type-body text-text-secondary">Ingen aktive flag.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {forwardAbuseUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between hf-surface p-4"
              >
                <div>
                  <p className="hf-type-body hf-type-strong text-hf-black">{user.displayName}</p>
                  <p className="hf-type-small text-text-muted">
                    Flagget {user.forwardAbuseFlaggedAt?.toLocaleString("da-DK")}
                  </p>
                </div>
                <ClearForwardFlagButton userId={user.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    </BulkSelection>
  );
}

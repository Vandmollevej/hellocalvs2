import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reassessOffProduct } from "@/lib/off-quality-job";
import {
  OFF_IMAGE_DEFAULT_PER_PAGE,
  OFF_IMAGE_MIN_INTERACTIONS,
  OFF_IMAGE_PER_PAGE,
  OFF_IMAGE_SORTS,
  OFF_IMAGE_TABS,
  defaultSortFor,
  type OffImageDecision,
  type OffImageItem,
  type OffImageQuery,
  type OffImageSort,
  type OffImageTab,
} from "@/lib/off-image-review-shared";

// Admin Varedatabase → Open Food Facts → Billeder (docs/DECISIONS.md
// 2026-10-11). Alle Open Food Facts-billeder, vi har hentet ind på varer
// (externalSource = OPEN_FOOD_FACTS, billedet stadig OFF's egen https-adresse),
// gennemgås her som til gennemgang / godkendt / afvist (Product.offImageReview).
//
// Afvist betyder: billedet dur ikke som forside. Varen sendes til scan-appen
// (ProductQualityReview.scanRequestedAt — samme mekanisme som "Send til
// scan-appen" i Open Food Facts-kontrollen), så den står under "Skal scannes"
// og på hyldeoverlayet, og genscan-banneret ("Optjen 10 points") bliver ved med
// at blive tilbudt. Når en ny forside er gemt, er billedet ikke længere OFF's
// https-adresse, og varen forsvinder af sig selv fra listerne.

const TAB_DECISION: Record<OffImageTab, OffImageDecision | null> = { review: null, approved: "APPROVED", rejected: "REJECTED" };

// Samme afgrænsning som Open Food Facts-kontrollen (OFF_REVIEW_WHERE i
// off-quality-job.ts) + at billedet stadig er OFF's egen adresse.
export const OFF_IMAGE_WHERE = {
  externalSource: "OPEN_FOOD_FACTS",
  privateOwnerId: null,
  discontinued: false,
  status: { not: "REJECTED" },
  imageUrl: { startsWith: "https://" },
} satisfies Prisma.ProductWhereInput;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseOffImageQuery(params: Params): OffImageQuery {
  const tab = OFF_IMAGE_TABS.find((candidate) => candidate === first(params.tab)) ?? "review";
  let sort = OFF_IMAGE_SORTS.find((candidate) => candidate === first(params.sort)) ?? defaultSortFor(tab);
  // "Dato ændret" findes kun, når der er en dom.
  if (tab === "review" && sort.startsWith("changed_")) sort = defaultSortFor(tab);
  const perPageRaw = Number(first(params.perPage));
  const perPage = (OFF_IMAGE_PER_PAGE as readonly number[]).includes(perPageRaw) ? perPageRaw : OFF_IMAGE_DEFAULT_PER_PAGE;
  const minRaw = Number(first(params.min));
  const minInteractions = (OFF_IMAGE_MIN_INTERACTIONS as readonly number[]).includes(minRaw) ? minRaw : 0;
  // offset i stedet for sidetal: afgørelser fjerner varer fra "Til gennemgang",
  // så næste side skal starte ved den første ikke-afgjorte vare.
  const offsetRaw = Number(first(params.offset));
  const pageRaw = Number(first(params.page));
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor((pageRaw - 1) * perPage) : 0;
  const q = (first(params.q) ?? "").trim().slice(0, 80);
  return { tab, sort, perPage, offset, minInteractions, q };
}

const ORDER_BY: Record<OffImageSort, string> = {
  interactions_desc: `sc.interactions DESC, sc."createdAt" DESC, sc.id`,
  interactions_asc: `sc.interactions ASC, sc."createdAt" DESC, sc.id`,
  added_desc: `sc."createdAt" DESC, sc.id`,
  added_asc: `sc."createdAt" ASC, sc.id`,
  changed_desc: `sc."offImageReviewedAt" DESC NULLS LAST, sc.id`,
  changed_asc: `sc."offImageReviewedAt" ASC NULLS LAST, sc.id`,
};

type Row = {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
  offImageReview: OffImageDecision | null;
  offImageReviewedAt: Date | null;
  scanRequestedAt: Date | null;
  scanDoneAt: Date | null;
  brandName: string | null;
  barcode: string | null;
  scans: number;
  registrations: number;
  favorites: number;
  forwards: number;
  interactions: number;
  total: number;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function runPage(query: OffImageQuery, offset: number): Promise<Row[]> {
  const decision = TAB_DECISION[query.tab];
  const reviewCondition = decision
    ? Prisma.sql`p."offImageReview" = ${decision}::"OffImageReview"`
    : Prisma.sql`p."offImageReview" IS NULL`;
  const like = `%${escapeLike(query.q)}%`;
  const searchCondition = query.q
    ? Prisma.sql`AND (p.name ILIKE ${like} OR EXISTS (SELECT 1 FROM barcodes bq WHERE bq."productId" = p.id AND bq.code LIKE ${`${escapeLike(query.q)}%`}))`
    : Prisma.empty;

  // Interaktioner = scanninger (stregkodeopslag i debug_logs) + registreringer
  // + favoritter + videresendelser. Tallene tælles kun for varerne på listen.
  return prisma.$queryRaw<Row[]>(Prisma.sql`
    WITH base AS (
      SELECT p.id, p.name, p."imageUrl", p."createdAt", p."offImageReview", p."offImageReviewedAt", p."brandId"
      FROM products p
      WHERE p."externalSource" = 'OPEN_FOOD_FACTS'
        AND p."privateOwnerId" IS NULL
        AND p."discontinued" = false
        AND p."status" <> 'REJECTED'
        AND p."imageUrl" LIKE 'https://%'
        AND ${reviewCondition}
        ${searchCondition}
    ),
    scored AS (
      SELECT b.*,
        COALESCE(s.n, 0) AS scans,
        COALESCE(r.n, 0) AS registrations,
        COALESCE(f.n, 0) AS favorites,
        COALESCE(w.n, 0) AS forwards,
        COALESCE(s.n, 0) + COALESCE(r.n, 0) + COALESCE(f.n, 0) + COALESCE(w.n, 0) AS interactions
      FROM base b
      LEFT JOIN (
        SELECT bc."productId", count(*)::int AS n
        FROM debug_logs d
        JOIN barcodes bc ON bc.code = d.barcode
        WHERE d.category = 'scan' AND d.event = 'barcode_lookup' AND bc."productId" IN (SELECT id FROM base)
        GROUP BY bc."productId"
      ) s ON s."productId" = b.id
      LEFT JOIN (
        SELECT "productId", count(*)::int AS n FROM registrations
        WHERE "productId" IN (SELECT id FROM base) GROUP BY "productId"
      ) r ON r."productId" = b.id
      LEFT JOIN (
        SELECT "productId", count(*)::int AS n FROM favorites
        WHERE "productId" IN (SELECT id FROM base) GROUP BY "productId"
      ) f ON f."productId" = b.id
      LEFT JOIN (
        SELECT "productId", count(*)::int AS n FROM forwards
        WHERE "productId" IN (SELECT id FROM base) GROUP BY "productId"
      ) w ON w."productId" = b.id
    )
    SELECT sc.id, sc.name, sc."imageUrl", sc."createdAt", sc."offImageReview", sc."offImageReviewedAt",
      qr."scanRequestedAt", qr."scanDoneAt",
      br.name AS "brandName",
      (SELECT bc.code FROM barcodes bc WHERE bc."productId" = sc.id ORDER BY bc.code LIMIT 1) AS barcode,
      sc.scans, sc.registrations, sc.favorites, sc.forwards, sc.interactions,
      (count(*) OVER ())::int AS total
    FROM scored sc
    LEFT JOIN brands br ON br.id = sc."brandId"
    LEFT JOIN product_quality_reviews qr ON qr."productId" = sc.id
    WHERE sc.interactions >= ${query.minInteractions}
    ORDER BY ${Prisma.raw(ORDER_BY[query.sort])}
    LIMIT ${query.perPage} OFFSET ${offset}
  `);
}

export type OffImagePage = {
  items: OffImageItem[];
  total: number;
  offset: number;
  counts: Record<OffImageTab, number>;
};

export async function loadOffImagePage(query: OffImageQuery): Promise<OffImagePage> {
  let offset = query.offset;
  let rows = await runPage(query, offset);
  // Siden er tom (fx efter at de sidste varer er afgjort): gå til første side.
  if (!rows.length && offset > 0) {
    offset = 0;
    rows = await runPage(query, 0);
  }

  const grouped = await prisma.product.groupBy({
    by: ["offImageReview"],
    where: OFF_IMAGE_WHERE,
    _count: { _all: true },
  });
  const counts: Record<OffImageTab, number> = { review: 0, approved: 0, rejected: 0 };
  for (const row of grouped) {
    if (row.offImageReview === "APPROVED") counts.approved = row._count._all;
    else if (row.offImageReview === "REJECTED") counts.rejected = row._count._all;
    else counts.review += row._count._all;
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brandName,
      barcode: row.barcode,
      imageUrl: row.imageUrl,
      interactions: row.interactions,
      scans: row.scans,
      registrations: row.registrations,
      favorites: row.favorites,
      forwards: row.forwards,
      addedAt: row.createdAt.toISOString(),
      reviewedAt: row.offImageReviewedAt ? row.offImageReviewedAt.toISOString() : null,
      review: row.offImageReview,
      scanStatus: row.scanRequestedAt ? (row.scanDoneAt ? "done" : "pending") : "none",
    })),
    total: rows[0]?.total ?? 0,
    offset,
    counts,
  };
}

// decision null = tilbage til gennemgang. Rører kun Open Food Facts-varer.
// Afvist → varen sendes til scan-appen; godkendt/tilbage → en åben forespørgsel,
// som netop denne afvisning oprettede, trækkes tilbage.
export async function setOffImageReview(ids: string[], decision: OffImageDecision | null, adminId: string) {
  if (!ids.length) return 0;
  const previouslyRejected = (
    await prisma.product.findMany({
      where: { id: { in: ids }, externalSource: "OPEN_FOOD_FACTS", offImageReview: "REJECTED" },
      select: { id: true },
    })
  ).map((row) => row.id);

  const result = await prisma.product.updateMany({
    where: { id: { in: ids }, externalSource: "OPEN_FOOD_FACTS" },
    data: {
      offImageReview: decision,
      offImageReviewedAt: decision ? new Date() : null,
      offImageReviewedById: decision ? adminId : null,
    },
  });

  if (decision === "REJECTED") {
    // Vurderingsrækken oprettes, hvis robotten "off-quality" ikke har nået varen endnu.
    for (const id of ids) {
      await reassessOffProduct(id).catch((error) => console.error("Open Food Facts-vurdering fejlede", id, error));
    }
    await prisma.productQualityReview.updateMany({
      where: { productId: { in: ids } },
      data: { scanRequestedAt: new Date(), scanRequestedByAdminId: adminId, scanDoneAt: null, scanDoneByWorkerId: null },
    });
  } else if (previouslyRejected.length) {
    await prisma.productQualityReview.updateMany({
      where: { productId: { in: previouslyRejected }, scanRequestedAt: { not: null }, scanDoneAt: null },
      data: { scanRequestedAt: null, scanRequestedByAdminId: null },
    });
  }
  return result.count;
}

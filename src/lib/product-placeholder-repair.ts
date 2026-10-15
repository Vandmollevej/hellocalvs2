import { prisma } from "@/lib/prisma";
import { brandProductName } from "@/lib/product-placeholder-name";
import { askProductType, findProductType, nameProductType } from "@/lib/product-type-name";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";
import { debugLog } from "@/lib/debug-log";

// Varer, der stadig hedder "Vare <stregkode>" (fra før brugerens regel
// 2026-10-15), får varetypen fra deres gemte forsideaflæsning (fx Eierlikör),
// ellers fra spørgsmålet "Hvilken produkttype er <brand subbrand variant>?",
// ellers brand + subbrand. Har varen heller intet brand, bliver navnet tomt
// frem for reservenavnet. Registreringer, hvis
// titleSnapshot er præcis reservenavnet, får det nye navn: reservenavnet var
// aldrig et rigtigt navn, så det er ikke et snapshot, der skal bevares.
// Kører hvert kvarter (vedligehold) og om natten. Varer, hvis forside stadig
// læses, navngives af enrichFront; hænger navnet som ventende i over en halv
// time, omdøbes varen også her (brugerens fejlmelding 2026-10-15: Verpoorten
// hed stadig "Vare 40157818" efter deploy).
const PENDING_NAME_GRACE_MS = 30 * 60 * 1000;

export async function repairPlaceholderNames(now: Date = new Date()): Promise<number> {
  const products = await prisma.product.findMany({
    where: {
      name: { startsWith: "Vare " },
      OR: [
        { NOT: { pendingFields: { has: "name" } } },
        { createdAt: { lt: new Date(now.getTime() - PENDING_NAME_GRACE_MS) } },
      ],
    },
    select: {
      id: true,
      name: true,
      subbrand: true,
      variant: true,
      pendingFields: true,
      brand: { select: { name: true } },
      aiAnalyses: { where: { kind: "FRONT" }, orderBy: { createdAt: "desc" }, take: 1, select: { prediction: true } },
    },
    take: 100,
  });
  let repaired = 0;
  for (const product of products) {
    if (!/^Vare \d{6,14}$/.test(product.name)) continue;
    const front = product.aiAnalyses[0]?.prediction as ProductFrontAnalysis | null | undefined;
    const typeName = await findProductType(front, {
      brand: product.brand?.name,
      subbrand: product.subbrand,
      variant: product.variant,
    });
    const name = typeName ?? brandProductName(product.brand?.name, product.subbrand);
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { name, pendingFields: product.pendingFields.filter((field) => field !== "name"), productTypeAskedAt: now },
      }),
      prisma.registration.updateMany({ where: { productId: product.id, titleSnapshot: product.name }, data: { titleSnapshot: name } }),
    ]);
    repaired += 1;
    await debugLog({
      category: "scan",
      event: "placeholder_name_repaired",
      message: `Reservenavnet "${product.name}" erstattet af ${name ? `"${name}"${typeName ? " (varetypen)" : " (brand + subbrand)"}` : "et tomt navn (intet brand)"}`,
      productId: product.id,
    });
  }
  return repaired + (await nameBrandOnlyProducts(now));
}

// Varer, der kun hedder brand + subbrand (fx "Verpoorten"), fordi forsiden
// ikke gav varetypen: spørg "Hvilken produkttype er <brand subbrand variant>?"
// og omdøb varen, hvis svaret er sikkert (brugerens regel 2026-10-15). Brand +
// subbrand var kun et nødnavn, så registreringer med præcis det navn får
// varetypen med. Kun et navn, brugeren selv har valgt, røres ikke.
// Fejler kaldet (netværk, OpenAI), prøves igen næste kvarter; kun et svar
// ("ved ikke") markerer varen som spurgt. Varer spurgt før RETRY_ASKED_BEFORE
// spørges én gang til: de blev sprunget over, når forsiden havde et navn eller
// manglede, eller markeret som spurgt efter en fejl (brugerens fejlmelding
// 2026-10-15: Verpoorten fik stadig ikke varetypen).
const BRAND_ONLY_BATCH = 25;
export const RETRY_ASKED_BEFORE = new Date("2026-10-15T17:30:00Z");

async function nameBrandOnlyProducts(now: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "products" p
    JOIN "brands" b ON b.id = p."brandId"
    WHERE (p."productTypeAskedAt" IS NULL OR p."productTypeAskedAt" < ${RETRY_ASKED_BEFORE})
      AND p."externalSource" IS NULL
      AND NOT ('name' = ANY(p."pendingFields"))
      AND (
        btrim(p.name) = ''
        OR lower(btrim(p.name)) = lower(btrim(b.name))
        OR lower(btrim(p.name)) = lower(btrim(coalesce(p.subbrand, '')))
        OR lower(btrim(p.name)) = lower(btrim(b.name) || ' ' || btrim(coalesce(p.subbrand, '')))
      )
    ORDER BY p."createdAt" DESC
    LIMIT ${BRAND_ONLY_BATCH}
  `;
  let renamed = 0;
  for (const row of rows) {
    if (await nameBrandOnlyProduct(row.id, now).catch(() => false)) renamed += 1;
  }
  return renamed;
}

// Én vare: også brugt af varesiden, så varen får varetypen, når den vises.
export async function nameBrandOnlyProduct(productId: string, now: Date = new Date()): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      subbrand: true,
      variant: true,
      packageSizeText: true,
      language: true,
      brand: { select: { name: true } },
      filters: { select: { alcoholPercent: true } },
      aiAnalyses: { where: { kind: "FRONT" }, orderBy: { createdAt: "desc" }, take: 1, select: { prediction: true, correction: true } },
    },
  });
  if (!product) return false;
  const analysis = product.aiAnalyses[0];
  const chosen = (analysis?.correction as { productName?: string | null } | null)?.productName?.trim();
  // Brugeren har selv valgt navnet (fx "Coca-Cola").
  if (chosen && chosen === product.name.trim()) {
    await prisma.product.update({ where: { id: product.id }, data: { productTypeAskedAt: now } });
    return false;
  }
  const front = analysis?.prediction as ProductFrontAnalysis | null | undefined;
  const fromFront = front ? await nameProductType(front).catch(() => null) : null;
  // Fejl kastes videre: varen markeres ikke som spurgt og prøves igen.
  const typeName =
    fromFront ??
    (await askProductType({
      brand: product.brand?.name,
      subbrand: product.subbrand,
      variant: product.variant,
      packageSizeText: product.packageSizeText,
      alcoholPercent: product.filters?.alcoholPercent ?? null,
      language: product.language,
    }));
  if (!typeName) {
    await prisma.product.update({ where: { id: product.id }, data: { productTypeAskedAt: now } });
    return false;
  }
  await prisma.$transaction([
    prisma.product.update({ where: { id: product.id }, data: { name: typeName, productTypeAskedAt: now } }),
    prisma.registration.updateMany({ where: { productId: product.id, titleSnapshot: product.name }, data: { titleSnapshot: typeName } }),
  ]);
  await debugLog({
    category: "scan",
    event: "product_type_named",
    message: `"${product.name}" hedder nu "${typeName}" (varetypen spurgt hos OpenAI)`,
    productId: product.id,
  });
  return true;
}

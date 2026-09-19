import { prisma } from "@/lib/prisma";

// Products created within this window of each other, with the same
// normalized name, are flagged as a simultaneous-creation duplicate (see
// docs/ADMIN.md "Dobbeltoprettelser"). Deliberately short — this targets two
// people (or an offline-queued submission replaying after an online one
// already landed, see src/lib/offline-product-queue.ts) independently
// creating "the same" product at nearly the same time, not the broader
// name-only "mulige dubletter" list already shown on /admin/warnings.
const SIMULTANEOUS_WINDOW_MS = 10 * 60 * 1000;

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

// Called right after a product is created (src/app/api/products/route.ts).
// Never throws — a failure here must not fail the product creation itself.
export async function flagSimultaneousDuplicates(productId: string, name: string, createdAt: Date) {
  try {
    const normalized = normalizeName(name);
    const windowStart = new Date(createdAt.getTime() - SIMULTANEOUS_WINDOW_MS);
    const windowEnd = new Date(createdAt.getTime() + SIMULTANEOUS_WINDOW_MS);

    const candidates = await prisma.product.findMany({
      where: {
        id: { not: productId },
        createdAt: { gte: windowStart, lte: windowEnd },
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });

    for (const candidate of candidates) {
      if (normalizeName(candidate.name) !== normalized) continue;
      const [productAId, productBId] = [productId, candidate.id].sort();
      await prisma.productDuplicateLink.upsert({
        where: { productAId_productBId: { productAId, productBId } },
        update: {},
        create: { productAId, productBId },
      });
    }
  } catch (error) {
    console.error("Duplicate-link detection failed", error);
  }
}

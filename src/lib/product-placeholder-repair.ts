import { prisma } from "@/lib/prisma";
import { brandProductName } from "@/lib/product-placeholder-name";
import { nameProductType } from "@/lib/product-type-name";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";
import { debugLog } from "@/lib/debug-log";

// Varer, der stadig hedder "Vare <stregkode>" (fra før brugerens regel
// 2026-10-15), får varetypen fra deres gemte forsideaflæsning (fx Eierlikör),
// ellers brand + subbrand. Har varen heller intet brand, bliver navnet tomt
// frem for reservenavnet. Registreringer, hvis
// titleSnapshot er præcis reservenavnet, får det nye navn: reservenavnet var
// aldrig et rigtigt navn, så det er ikke et snapshot, der skal bevares.
export async function repairPlaceholderNames(): Promise<number> {
  const products = await prisma.product.findMany({
    // Varer, hvis forside stadig læses, navngives af enrichFront.
    where: { name: { startsWith: "Vare " }, NOT: { pendingFields: { has: "name" } } },
    select: {
      id: true,
      name: true,
      subbrand: true,
      brand: { select: { name: true } },
      aiAnalyses: { where: { kind: "FRONT" }, orderBy: { createdAt: "desc" }, take: 1, select: { prediction: true } },
    },
    take: 100,
  });
  let repaired = 0;
  for (const product of products) {
    if (!/^Vare \d{6,14}$/.test(product.name)) continue;
    const front = product.aiAnalyses[0]?.prediction as ProductFrontAnalysis | null | undefined;
    const typeName = front ? await nameProductType(front).catch(() => null) : null;
    const name = typeName ?? brandProductName(product.brand?.name, product.subbrand);
    await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: { name } }),
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
  return repaired;
}

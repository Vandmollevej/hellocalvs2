import { prisma } from "@/lib/prisma";
import { brandProductName } from "@/lib/product-placeholder-name";
import { debugLog } from "@/lib/debug-log";

// Varer, der stadig hedder "Vare <stregkode>" (fra før brugerens regel
// 2026-10-15), omdøbes til brand + subbrand — lokalt, ingen AI. Har varen intet
// brand, bliver navnet tomt frem for reservenavnet. Registreringer, hvis
// titleSnapshot er præcis reservenavnet, får det nye navn: reservenavnet var
// aldrig et rigtigt navn, så det er ikke et snapshot, der skal bevares.
export async function repairPlaceholderNames(): Promise<number> {
  const products = await prisma.product.findMany({
    // Varer, hvis forside stadig læses, navngives af enrichFront.
    where: { name: { startsWith: "Vare " }, NOT: { pendingFields: { has: "name" } } },
    select: { id: true, name: true, subbrand: true, brand: { select: { name: true } } },
    take: 500,
  });
  let repaired = 0;
  for (const product of products) {
    if (!/^Vare \d{6,14}$/.test(product.name)) continue;
    const name = brandProductName(product.brand?.name, product.subbrand);
    await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: { name } }),
      prisma.registration.updateMany({ where: { productId: product.id, titleSnapshot: product.name }, data: { titleSnapshot: name } }),
    ]);
    repaired += 1;
    await debugLog({
      category: "scan",
      event: "placeholder_name_repaired",
      message: `Reservenavnet "${product.name}" erstattet af ${name ? `"${name}" (brand + subbrand)` : "et tomt navn (intet brand)"}`,
      productId: product.id,
    });
  }
  return repaired;
}

import { prisma } from "@/lib/prisma";

// Nøgletal til den offentlige forside — altid rigtige tal fra databasen, aldrig
// opfundne. Fejler databasen, vises sektionen blot ikke.

export type LandingStat = { key: string; value: number; label: string };

export async function getLandingStats(): Promise<LandingStat[] | null> {
  try {
    const [products, brands, additives, recipes] = await Promise.all([
      prisma.product.count({ where: { status: "APPROVED" } }),
      prisma.brand.count(),
      prisma.additive.count(),
      prisma.sharedRecipe.count(),
    ]);
    return [
      { key: "products", value: products, label: "Fødevarer" },
      { key: "brands", value: brands, label: "Mærker" },
      { key: "recipes", value: recipes, label: "Delte opskrifter" },
      { key: "additives", value: additives, label: "E-numre forklaret" },
    ];
  } catch (error) {
    console.error("[landing] nøgletal kunne ikke hentes", error);
    return null;
  }
}

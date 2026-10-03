// Trigger-reglen for reklamespots (docs/DECISIONS.md 2026-10-02): har et spot
// en produktkategori og/eller produkttype, vises det kun, når den aktuelle
// vare har præcis dem. Rent modul uden databaseafhængighed, så det kan testes.
export function triggerMatches(
  spot: { triggerCategory: string | null; triggerProductType: string | null },
  context: { category?: string | null; productType?: string | null }
) {
  if (spot.triggerCategory && spot.triggerCategory !== context.category) return false;
  if (spot.triggerProductType) {
    const wanted = spot.triggerProductType.trim().toLowerCase();
    if (!context.productType || context.productType.trim().toLowerCase() !== wanted) return false;
  }
  return true;
}

// Billedet en bruger ser for en vare (docs/DECISIONS.md 2026-09-28): den, der
// oprettede varen, ser forsidefotoet med det samme (Product.imageUrl), og det
// overskrives af den fritlagte forside (pendingImageUrl), så snart
// image-agent har lavet den. Andre ser først det fritlagte efter
// admin-godkendelse. Samme regel som produktskærmen (AddProductView).
export function productImageForViewer(
  product: { imageUrl: string | null; pendingImageUrl: string | null; createdByUserId: string | null },
  viewerId: string | null | undefined,
): string | null {
  if (product.pendingImageUrl && viewerId && product.createdByUserId === viewerId) {
    return product.pendingImageUrl;
  }
  return product.imageUrl;
}

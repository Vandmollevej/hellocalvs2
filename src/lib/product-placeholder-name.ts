// Reservenavnet "Vare <stregkode>" får en hurtigt oprettet vare, indtil AI'en
// har læst forsiden. Det må aldrig blive stående som varens titel: kunne
// forsiden ikke give et varenavn, navngives varetypen ud fra resten af
// forsiden (src/lib/product-type-name.ts).

export function placeholderProductName(barcode: string) {
  return `Vare ${barcode}`;
}

export function isPlaceholderProductName(name: string | null | undefined) {
  return /^Vare \d{6,14}$/.test((name ?? "").trim());
}

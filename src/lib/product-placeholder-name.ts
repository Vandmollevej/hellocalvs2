// Brugerens regel (2026-10-15): en vare må aldrig vises som "Vare <stregkode>"
// — heller ikke mens den oprettes. Har varen intet egentligt varenavn (fx
// Verpoorten Original: brand + variant), hedder den brand + subbrand; varianten
// står i sit eget felt (grøn linje) og aldrig i navnet. Varetypen opfindes
// ikke. Reservenavnet fra før reglen genkendes, så det kan erstattes.

export function isPlaceholderProductName(name: string | null | undefined) {
  return /^Vare \d{6,14}$/.test((name ?? "").trim());
}

// Navnet på en vare uden varenavn: brand + subbrand, uden gentagelse.
export function brandProductName(brand: string | null | undefined, subbrand: string | null | undefined) {
  const b = brand?.trim() ?? "";
  const s = subbrand?.trim() ?? "";
  if (!b || !s) return b || s;
  if (s.toLowerCase().includes(b.toLowerCase())) return s;
  if (b.toLowerCase().includes(s.toLowerCase())) return b;
  return `${b} ${s}`;
}

// Værn i visningen: står reservenavnet stadig i databasen (fx før natten har
// omdøbt varen), vises brand + subbrand i stedet — aldrig "Vare <stregkode>".
export function displayProductName(
  name: string | null | undefined,
  brand: string | null | undefined,
  subbrand: string | null | undefined,
) {
  return isPlaceholderProductName(name) ? brandProductName(brand, subbrand) : (name ?? "");
}

// Anchor id / URL for one E-number's section on the combined /e-numre page,
// e.g. "E150a" -> "e150a" -> /e-numre#e150a.
export function additiveAnchorId(eNumber: string): string {
  return eNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function additivePageHref(eNumber: string): string {
  return `/e-numre#${additiveAnchorId(eNumber)}`;
}

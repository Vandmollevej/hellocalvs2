// WebKit (Safari på iPhone/iPad/Mac — og alle browsere på iOS) har
// ImageCapture, men takePhoto() hænger og efterlader videoen frosset og sort,
// uden at sporet meldes mute/ended (brugerens sorte kamera på trin 3/4,
// 2026-10-14; docs/DECISIONS.md). Dér bruges videobilledet i stedet.
export function isWebKit(nav: { vendor?: string; userAgent?: string } | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav) return false;
  if (/\b(iPhone|iPad|iPod)\b/.test(nav.userAgent ?? "")) return true;
  return (nav.vendor ?? "").includes("Apple");
}


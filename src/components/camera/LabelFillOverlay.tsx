import type { OcrBox } from "@/lib/product-ocr-prioritized";

// Hvid udfyldning af det tekstfelt (næringstabel/ingrediensliste), som netop
// blev læst, oven på den levende video (docs/DECISIONS.md 2026-10-02).
// Boksene er i det læste billedes pixels; videoen vises som `object-cover` i
// en kvadratisk boks, og SVG'ens "xMidYMid slice" beskærer præcis ens, så
// fladen sidder på teksten. Afløser den grønne ramme på et frosset foto.
export function LabelFillOverlay({
  width,
  height,
  boxes,
  label,
}: {
  width: number;
  height: number;
  boxes: OcrBox[];
  label: string;
}) {
  const padding = Math.min(width, height) * 0.015;
  const radius = Math.min(width, height) * 0.02;
  return (
    <svg
      className="hf-scan-fill pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
    >
      {boxes.map((box, index) => (
        <rect
          key={index}
          x={Math.max(0, box.x0 - padding)}
          y={Math.max(0, box.y0 - padding)}
          width={Math.min(width, box.x1 + padding) - Math.max(0, box.x0 - padding)}
          height={Math.min(height, box.y1 + padding) - Math.max(0, box.y0 - padding)}
          rx={radius}
          fill="var(--hf-color-white, #fff)"
        />
      ))}
    </svg>
  );
}

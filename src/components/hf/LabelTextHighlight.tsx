import type { OcrBox } from "@/lib/product-ocr-prioritized";

// Grøn ramme (kun kant) om tekstfeltet med næring/ingredienser på et foto i
// kameraflowet (docs/DECISIONS.md 2026-09-28). Fotoet vises som
// `object-cover` i en kvadratisk boks; SVG'ens viewBox i fotoets pixels med
// "xMidYMid slice" beskærer præcis ens, så rammen sidder på teksten.
export function LabelTextHighlight({
  photo,
  width,
  height,
  boxes,
  label,
}: {
  photo: string;
  width: number;
  height: number;
  boxes: OcrBox[];
  label: string;
}) {
  const padding = Math.min(width, height) * 0.015;
  const radius = Math.min(width, height) * 0.02;
  return (
    <div className="pointer-events-none absolute inset-0" role="img" aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {boxes.map((box, index) => (
          <rect
            key={index}
            x={Math.max(0, box.x0 - padding)}
            y={Math.max(0, box.y0 - padding)}
            width={Math.min(width, box.x1 + padding) - Math.max(0, box.x0 - padding)}
            height={Math.min(height, box.y1 + padding) - Math.max(0, box.y0 - padding)}
            rx={radius}
            fill="none"
            stroke="var(--hf-color-positive)"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

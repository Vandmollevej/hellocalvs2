import type { Sketch } from "./sketch-data";
import { layoutSketch } from "./sketch-layout";

// Tegner én skitse i 1:1 CSS-pixels: rå kasser i elementernes egne farver,
// ingen tekst — kun bredde × højde inde i hver kasse. Måltallene ligger i et
// lag over alle kasser, så en ydre kasses mål aldrig gemmes bag en indre.

export function SketchFrame({ sketch }: { sketch: Sketch }) {
  const width = sketch.width / sketch.scale;
  const height = sketch.height / sketch.scale;
  const boxes = layoutSketch(sketch);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[18px] border border-border-strong"
      style={{ width, height, background: sketch.background }}
      role="img"
      aria-label={`Skitse af ${sketch.title}, ${width} × ${height} px`}
    >
      {boxes.map((box, index) => (
        <div
          key={index}
          title={`${box.name} · x ${Math.round(box.rect.x)}, y ${Math.round(box.rect.y)} · ${box.label}`}
          className="absolute box-border"
          style={{
            left: box.rect.x,
            top: box.rect.y,
            width: box.rect.w,
            height: box.rect.h,
            background: box.fill ?? "transparent",
            border: box.border ? `1px solid ${box.border}` : undefined,
            borderRadius: box.radius,
          }}
        />
      ))}
      {boxes.map((box, index) => (
        <span
          key={index}
          className="pointer-events-none absolute whitespace-nowrap rounded-[2px] font-mono leading-none tabular-nums"
          style={{
            left: box.labelCenter.x,
            top: box.labelCenter.y,
            transform: "translate(-50%, -50%)",
            fontSize: box.fontSize,
            color: box.labelColor,
            background: box.pill ? (box.fill ?? sketch.background) : undefined,
            padding: box.pill ? "1px 2px" : undefined,
          }}
        >
          {box.label}
        </span>
      ))}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { SKETCHES } from "./sketch-data";
import { layoutSketch } from "./sketch-layout";
import { SketchFrame } from "./SketchFrame";

// Designmanual → Skitser: hvert skærmbillede fra "Hello Fresh inspiration"
// tegnet som rå opsætningskasser med pixelmål, side om side med originalen.

export default async function DesignManualSketchesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="hf-type-caption uppercase tracking-[0.08em]">
          <Link href="/admin/designmanual" className="underline">Designmanual</Link> · Skitser
        </p>
        <h1 className="hf-type-hero">Skitser i pixels</h1>
        <p className="hf-type-body-sm text-text-secondary">
          Skærmbillederne er målt pixel for pixel og tegnet som rå kasser i de farver, de har — uden tekst. Tallene i
          kasserne er bredde × højde i CSS-pixels (skærmbilledets pixels ÷ 3). Tekst og ikoner er massive kasser i deres
          egen farve. Hold musen over en kasse for navn og position.
        </p>
      </header>

      {SKETCHES.map((sketch) => {
        const width = sketch.width / sketch.scale;
        const height = sketch.height / sketch.scale;
        return (
          <section key={sketch.id} id={sketch.id} className="flex scroll-mt-6 flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="hf-heading text-2xl text-text-primary">{sketch.title}</h2>
              <p className="font-mono text-xs text-text-muted">
                {sketch.file} · {width} × {height} px · baggrund {sketch.background}
              </p>
            </div>

            <div className="flex flex-wrap gap-6">
              <figure className="flex flex-col gap-2">
                <SketchFrame sketch={sketch} />
                <figcaption className="hf-type-caption">Skitse</figcaption>
              </figure>
              <figure className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- statisk referencebillede i 1:1 CSS-pixels */}
                <img
                  src={sketch.image}
                  alt={`Original: ${sketch.title}`}
                  width={width}
                  height={height}
                  className="shrink-0 rounded-[18px] border border-border-strong"
                  style={{ width, height }}
                />
                <figcaption className="hf-type-caption">Original</figcaption>
              </figure>
            </div>

            <details className="rounded-lg border border-border-strong bg-surface-2">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-primary">Målliste</summary>
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full text-left text-xs">
                  <thead className="text-text-muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Element</th>
                      <th className="py-1 pr-3 font-medium">x</th>
                      <th className="py-1 pr-3 font-medium">y</th>
                      <th className="py-1 pr-3 font-medium">B × H</th>
                      <th className="py-1 pr-3 font-medium">Farve</th>
                      <th className="py-1 pr-3 font-medium">Kant</th>
                      <th className="py-1 font-medium">Radius</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums text-text-primary">
                    {layoutSketch(sketch).map((box, index) => (
                      <tr key={index} className="border-t border-border-strong">
                        <td className="py-1 pr-3 font-sans">{box.name}</td>
                        <td className="py-1 pr-3">{Math.round(box.rect.x)}</td>
                        <td className="py-1 pr-3">{Math.round(box.rect.y)}</td>
                        <td className="py-1 pr-3">{box.label}</td>
                        <td className="py-1 pr-3">
                          {box.fill ? <ColorChip hex={box.fill} /> : "—"}
                        </td>
                        <td className="py-1 pr-3">{box.border ? <ColorChip hex={box.border} /> : "—"}</td>
                        <td className="py-1">{box.radius ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}

function ColorChip({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-3 rounded-sm border border-border-strong" style={{ background: hex }} />
      {hex}
    </span>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { SKETCHES } from "./data";
import { formatPx, layoutSketch } from "./sketch-layout";
import { SketchFrame } from "./SketchFrame";

// Designmanual → Skitser: hvert billede fra "Hello Fresh inspiration" tegnet
// som rå opsætningskasser med pixelmål, side om side med originalen. Én skitse
// ad gangen (?s=<id>), så siden ikke skal rendere alle kasser på én gang.

const BASE = "/admin/designmanual/skitser";

export default async function DesignManualSketchesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { s } = await searchParams;
  const index = Math.max(0, SKETCHES.findIndex((sketch) => sketch.id === s));
  const sketch = SKETCHES[index];
  const prev = SKETCHES[index - 1];
  const next = SKETCHES[index + 1];
  const width = sketch.width / sketch.scale;
  const height = sketch.height / sketch.scale;
  const boxes = layoutSketch(sketch);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="hf-type-caption uppercase tracking-[0.08em]">
          <Link href="/admin/designmanual" className="underline">Designmanual</Link> · Skitser
        </p>
        <h1 className="hf-type-hero">Skitser i pixels</h1>
        <p className="hf-type-body text-text-secondary">
          Billederne er målt pixel for pixel og tegnet som rå kasser i de farver, de har — uden tekst. Tallene i kasserne
          er bredde × højde i CSS-pixels (skærmbilledets pixels ÷ 3). Tekst og ikoner er massive kasser i deres egen farve;
          fotos er en kasse i fotoets gennemsnitsfarve med et kryds. Hold musen over en kasse for navn og position.
        </p>
      </header>

      <details className="hf-surface">
        <summary className="hf-type-body hf-type-strong cursor-pointer px-4 py-3 text-hf-black">
          Alle skitser ({SKETCHES.length})
        </summary>
        <ol className="hf-type-body grid gap-x-4 gap-y-1 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKETCHES.map((item, i) => (
            <li key={item.id}>
              <Link
                href={`${BASE}?s=${item.id}`}
                className={
                  item.id === sketch.id
                    ? "hf-type-strong text-hf-black"
                    : "text-text-secondary hover:text-text-primary hover:underline"
                }
              >
                <span className="hf-type-small inline-block w-7 text-text-muted tabular-nums">{i + 1}.</span>
                {item.title}
              </Link>
            </li>
          ))}
        </ol>
      </details>

      <section id={sketch.id} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="hf-type-page-title hf-heading text-hf-black">
              {index + 1}. {sketch.title}
            </h2>
            <p className="hf-type-small font-mono text-text-muted">
              {sketch.file} · {formatPx(width)} × {formatPx(height)} px · baggrund {sketch.background}
              {sketch.scale !== 3 && ` · 1 px = ${sketch.scale} billedpixels`}
            </p>
          </div>
          <nav aria-label="Skift skitse" className="hf-type-body flex gap-2">
            {prev && (
              <Link href={`${BASE}?s=${prev.id}`} className="hf-btn-secondary rounded-md px-3 py-1.5">
                ← Forrige
              </Link>
            )}
            {next && (
              <Link href={`${BASE}?s=${next.id}`} className="hf-btn-secondary rounded-md px-3 py-1.5">
                Næste →
              </Link>
            )}
          </nav>
        </div>

        <div className="flex flex-wrap gap-6">
          <figure className="flex flex-col gap-2">
            <SketchFrame sketch={sketch} />
            <figcaption className="hf-type-caption">Skitse</figcaption>
          </figure>
          <figure className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- indlejret referencebillede i 1:1 CSS-pixels */}
            <img
              src={sketch.image}
              alt={`Original: ${sketch.title}`}
              width={width}
              height={height}
              className="shrink-0 rounded-[18px] border border-hf-tan-dark"
              style={{ width, height }}
            />
            <figcaption className="hf-type-caption">Original</figcaption>
          </figure>
        </div>

        <details className="hf-surface">
          <summary className="hf-type-body hf-type-strong cursor-pointer px-4 py-3 text-hf-black">
            Målliste ({boxes.length} kasser)
          </summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="hf-type-small w-full text-left">
              <thead className="text-text-muted">
                <tr>
                  <th className="hf-type-strong py-1 pr-3">Element</th>
                  <th className="hf-type-strong py-1 pr-3">x</th>
                  <th className="hf-type-strong py-1 pr-3">y</th>
                  <th className="hf-type-strong py-1 pr-3">B × H</th>
                  <th className="hf-type-strong py-1 pr-3">Farve</th>
                  <th className="hf-type-strong py-1 pr-3">Kant</th>
                  <th className="hf-type-strong py-1">Radius</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-hf-black">
                {boxes.map((box, i) => (
                  <tr key={i} className="border-t border-hf-tan-dark">
                    <td className="py-1 pr-3 font-sans">{box.name}</td>
                    <td className="py-1 pr-3">{Math.round(box.rect.x)}</td>
                    <td className="py-1 pr-3">{Math.round(box.rect.y)}</td>
                    <td className="py-1 pr-3">{box.label}</td>
                    <td className="py-1 pr-3">{box.fill ? <ColorChip hex={box.fill} /> : "—"}</td>
                    <td className="py-1 pr-3">
                      {box.border ? (
                        <>
                          <ColorChip hex={box.border} /> {box.borderWidth ?? 1} px
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1">{box.radius ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}

function ColorChip({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-3 rounded-sm border border-hf-tan-dark" style={{ background: hex }} />
      {hex}
    </span>
  );
}

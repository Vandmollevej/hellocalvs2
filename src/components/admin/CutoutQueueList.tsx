import type { CutoutCropBox, CutoutQueueRow } from "@/lib/cutout-queue";
import { formatCopenhagenDateTime } from "@/lib/cutout-queue";

// Liste over fritlægningsjobs (docs/DECISIONS.md 2026-10-02). Rent visning:
// udsnittet tegnes med CSS ud fra jobbets cropBox (0–1 af billedet), så
// admin ser præcis det område, robotten kommer til at fritlægge.

const KIND_LABEL: Record<CutoutQueueRow["kind"], string> = {
  PRODUCT_FRONT: "Forside",
  BRAND_LOGO: "Logo",
};

function CropThumb({ src, cropBox }: { src: string; cropBox: CutoutCropBox | null }) {
  const style = cropBox
    ? {
        width: `${100 / cropBox.width}%`,
        height: `${100 / cropBox.height}%`,
        left: `${(-cropBox.x / cropBox.width) * 100}%`,
        top: `${(-cropBox.y / cropBox.height) * 100}%`,
      }
    : undefined;
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-hf-tan-dark bg-hf-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={cropBox ? "absolute max-w-none object-fill" : "h-full w-full object-contain p-1"}
        style={style}
      />
    </div>
  );
}

function Row({ row }: { row: CutoutQueueRow }) {
  const title = row.productName ?? row.brandName ?? row.recognizedText ?? "Ukendt vare";
  const details = [KIND_LABEL[row.kind], row.productName && row.brandName ? row.brandName : null, row.kind === "BRAND_LOGO" && row.recognizedText ? `læst: ${row.recognizedText}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <CropThumb src={row.sourceUrl} cropBox={row.cropBox} />
      <div className="min-w-0 flex-1">
        <p className="hf-type-strong truncate text-hf-black">{title}</p>
        <p className="hf-type-small text-text-secondary">{details}</p>
        {row.error && <p className="hf-type-small truncate text-hf-red-dark">{row.error}</p>}
      </div>
      <span className="hf-type-small shrink-0 text-text-muted">{formatCopenhagenDateTime(row.createdAt)}</span>
    </li>
  );
}

export function CutoutQueueList({ rows, emptyText }: { rows: CutoutQueueRow[]; emptyText: string }) {
  if (!rows.length) return <p className="hf-type-body text-text-secondary">{emptyText}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border-strong/50 rounded-lg border border-hf-tan-dark bg-hf-white">
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </ul>
  );
}

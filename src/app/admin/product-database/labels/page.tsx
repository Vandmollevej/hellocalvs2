import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadAdminLabels, type AdminLabelRow } from "@/lib/admin-labels";
import type { CertificationKind } from "@/lib/certification-badges";

// Admin "Produkt-database → Labels": designet som Brands/Logoer, men med
// navnet på hvert mærke, der findes på varerne (Økologisk, MSC, Nøglehul …).

const numberFormat = new Intl.NumberFormat("da-DK");

const BADGE_STYLE: Record<CertificationKind, { bg: string; fg: string; text: string }> = {
  organic: { bg: "#D2232A", fg: "#FFFFFF", text: "Ø" },
  keyhole: { bg: "#00843D", fg: "#FFFFFF", text: "⚲" },
  wholeGrain: { bg: "#B7791F", fg: "#FFFFFF", text: "HK" },
  animalWelfare: { bg: "#E08A00", fg: "#FFFFFF", text: "DV" },
  msc: { bg: "#005DAA", fg: "#FFFFFF", text: "MSC" },
  asc: { bg: "#00A0B0", fg: "#FFFFFF", text: "ASC" },
  fairtrade: { bg: "#00B9E4", fg: "#000000", text: "FT" },
  rainforest: { bg: "#2E7D32", fg: "#FFFFFF", text: "RA" },
  generic: { bg: "#8A8A8A", fg: "#FFFFFF", text: "" },
};

function LabelTile({ row }: { row: AdminLabelRow }) {
  const style = BADGE_STYLE[row.kind];
  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-md bg-hf-white">
      <span
        role="img"
        aria-label={row.label}
        className="flex h-16 w-16 items-center justify-center rounded-full font-bold"
        style={{ background: style.bg, color: style.fg, fontSize: style.text.length > 1 ? 20 : 30 }}
      >
        {style.text || row.label.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export default async function AdminLabelsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const rows = await loadAdminLabels();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Labels</h1>
        <p className="hf-type-body text-text-secondary">
          Alle mærker, der findes på varerne i Hello Cal, fx Økologisk og MSC, med antal varer.
        </p>
      </div>

      <p className="hf-type-body text-text-secondary">
        <span className="hf-type-strong text-hf-black">{numberFormat.format(rows.length)}</span> labels
      </p>

      {rows.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen labels fundet på varerne endnu.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex h-full flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-2">
                <LabelTile row={row} />
                <div className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
                  <p className="hf-type-body hf-type-strong truncate text-hf-black">{row.label}</p>
                  <p className="hf-type-small text-text-muted">
                    {numberFormat.format(row.productCount)} vare{row.productCount === 1 ? "" : "r"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

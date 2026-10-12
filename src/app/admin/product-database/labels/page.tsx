import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadAdminLabels, type AdminLabelRow } from "@/lib/admin-labels";
import { certificationLogoSrc } from "@/lib/certification-badges";

// Admin "Produkt-database → Labels": designet som Brands/Logoer, men med
// navnet på hvert mærke, der findes på varerne (Økologisk, MSC, Nøglehul …).

const numberFormat = new Intl.NumberFormat("da-DK");

function LabelTile({ row }: { row: AdminLabelRow }) {
  const src = certificationLogoSrc(row.kind);
  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-md bg-hf-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={row.label} className="h-16 max-w-full object-contain" />
      ) : (
        <span className="hf-type-body hf-type-strong text-hf-black">{row.label}</span>
      )}
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
        <ul className="hf-catalog-grid">
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

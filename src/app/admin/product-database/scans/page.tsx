import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadAdminUserScans } from "@/lib/admin-user-scans";
import { PRODUCT_SOURCE_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/admin-product-database-query";

// Admin "Varedatabase → Brugerscanninger" (bruger 2026-10-17): hver vare, en
// bruger har scannet, så admin kan se og rette den (src/lib/admin-user-scans.ts).

export const dynamic = "force-dynamic";

const timeFormat = new Intl.DateTimeFormat("da-DK", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Copenhagen",
});

function label<T extends string>(labels: Record<T, string>, key: string) {
  return (labels as Record<string, string>)[key] ?? key;
}

export default async function AdminUserScansPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const rows = await loadAdminUserScans();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Brugerscanninger</h1>
        <p className="hf-type-body text-text-secondary">
          Alle varer, brugerne scanner — også varer, der fandtes i forvejen (fx fra Open Food Facts). Nyeste først.
          Tryk på en vare for at rette den.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen scanninger endnu.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hf-tan-dark rounded-lg border border-hf-tan-dark bg-hf-white">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                href={`/admin/products/${row.productId}`}
                className="flex items-center gap-3 p-3 hover:bg-hf-tan"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-hf-tan">
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="hf-type-body hf-type-strong truncate text-hf-black">{row.name}</p>
                  <p className="hf-type-small truncate text-text-secondary">
                    {row.brand ?? "Uden mærke"} · {label(PRODUCT_SOURCE_LABELS, row.source)} ·{" "}
                    {label(PRODUCT_STATUS_LABELS, row.status)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                  <p className="hf-type-small text-hf-black">{row.userName}</p>
                  <p className="hf-type-small text-text-muted">
                    {row.created ? "Oprettet" : "Scannet"} {timeFormat.format(row.at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

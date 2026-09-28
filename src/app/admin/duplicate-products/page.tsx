import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { DuplicateCompareGroup } from "@/components/admin/DuplicateCompareGroup";
import { DuplicateImageGroup } from "@/components/admin/DuplicateImageGroup";
import {
  countDuplicateReviews,
  GROUPS_PER_PAGE,
  loadDuplicateImagePage,
  loadDuplicateProductPage,
} from "@/lib/duplicate-review";

// /admin/duplicate-products — "Dubletter" (docs/DECISIONS.md 2026-09-28).
// To faner, der håndteres hver for sig:
// - Produktbilleder (?tab=billeder): billed-varianter af samme vare
//   (EAN.png, EAN_2.png …) på én linje; vælg hovedbillede og fravælg resten.
// - Produkter (?tab=produkter): op til 6 kolonner side om side; vælg felt
//   for felt, hvad der skal i den endelige (grøn ramme). Logik i
//   src/lib/duplicate-review.ts.
export default async function AdminDuplicateProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; side?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const tab = params.tab === "produkter" ? "produkter" : "billeder";
  const page = Math.max(1, Number.parseInt(params.side ?? "1", 10) || 1);

  const [counts, images, products] = await Promise.all([
    countDuplicateReviews(),
    tab === "billeder" ? loadDuplicateImagePage(page) : null,
    tab === "produkter" ? loadDuplicateProductPage(page) : null,
  ]);
  const total = images?.total ?? products?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / GROUPS_PER_PAGE));

  const tabs = [
    { key: "billeder", label: "Produktbilleder", count: counts.images },
    { key: "produkter", label: "Produkter", count: counts.products },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Dubletter</h1>
        <p className="hf-type-body text-text-secondary">
          {tab === "billeder"
            ? "Flere billeder af samme vare (fx _1, _2, _3). Sammenlign dem på linjen, vælg hovedbilledet og fravælg dem, der ikke skal bruges."
            : "Samme vare flere gange. Kolonnerne står side om side; klik på en grøn pil for at tage værdien over i den endelige (grøn ramme)."}
        </p>
      </div>

      <div className="hf-type-body flex gap-4 border-b border-hf-tan-dark">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/duplicate-products?tab=${t.key}`}
            className={`-mb-px border-b-2 pb-2 ${
              tab === t.key
                ? "hf-type-strong border-hf-green-dark text-hf-green-dark"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      {images &&
        (images.groups.length === 0 ? (
          <p className="hf-type-body text-text-secondary">Ingen billed-dubletter afventer gennemgang.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {images.groups.map((group) => (
              <DuplicateImageGroup key={group.productId} group={group} />
            ))}
          </div>
        ))}

      {products &&
        (products.groups.length === 0 ? (
          <p className="hf-type-body text-text-secondary">Ingen produkt-dubletter afventer gennemgang.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {products.groups.map((group) => (
              <DuplicateCompareGroup key={group.key} group={group} />
            ))}
          </div>
        ))}

      {pages > 1 && (
        <div className="hf-type-small flex items-center justify-between text-text-secondary">
          {page > 1 ? (
            <Link href={`/admin/duplicate-products?tab=${tab}&side=${page - 1}`} className="text-hf-green-dark">
              ← Forrige
            </Link>
          ) : (
            <span />
          )}
          <span>
            Side {page} af {pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/duplicate-products?tab=${tab}&side=${page + 1}`} className="text-hf-green-dark">
              Næste →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { DuplicateImageList } from "@/components/admin/DuplicateImageList";
import { DuplicateList } from "@/components/admin/DuplicateList";
import {
  countDuplicateReviews,
  GROUPS_PER_PAGE,
  loadDuplicateImagePage,
  loadDuplicateProductPage,
} from "@/lib/duplicate-review";

// /admin/duplicate-products — "Dubletter" (docs/DECISIONS.md 2026-09-28).
// To faner, der håndteres hver for sig:
// - Produktbilleder (?tab=billeder): billed-varianter af samme vare
//   (EAN.png, EAN_2.png …): billedet i dag ved siden af ét alternativ;
//   "Behold" eller "Erstat med dette" sletter de øvrige (2026-10-11).
// - Produkter (?tab=varer): op til 6 kolonner side om side; vælg felt
//   for felt, hvad der skal i den endelige (grøn ramme). Logik i
//   src/lib/duplicate-review.ts. Listen kan vises som evigheds-scroll eller
//   sideinddelt (DuplicateList, docs/DECISIONS.md 2026-10-11).
export default async function AdminDuplicateProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; side?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const tab = params.tab === "varer" ? "varer" : "billeder";
  const page = Math.max(1, Number.parseInt(params.side ?? "1", 10) || 1);

  const [counts, images, products] = await Promise.all([
    countDuplicateReviews(),
    tab === "billeder" ? loadDuplicateImagePage(page) : null,
    tab === "varer" ? loadDuplicateProductPage(page) : null,
  ]);
  const total = images?.total ?? products?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / GROUPS_PER_PAGE));

  const tabs = [
    { key: "billeder", label: "Varebilleder", count: counts.images },
    { key: "varer", label: "Varer", count: counts.products },
  ] as const;

  return (
    <div className="hf-admin-page">
      <div>
        <h1 className="hf-type-title text-hf-black">Dubletter</h1>
        <p className="hf-type-body text-text-secondary">
          {tab === "billeder"
            ? "Flere billeder af samme vare (fx _1, _2, _3). Behold billedet, der vises i dag, eller erstat det med alternativet — de øvrige billeder slettes. Klik på et billede for at se det i stor størrelse."
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
          <DuplicateImageList groups={images.groups} />
        ))}

      {images && (
        <AdminPagination page={page} pageCount={pages} hrefFor={(next) => `/admin/duplicate-products?tab=${tab}&side=${next}`} />
      )}

      {products && (
        <DuplicateList
          key={page}
          page={page}
          pages={pages}
          total={total}
          perPage={GROUPS_PER_PAGE}
          initialGroups={products.groups}
          initialConsumed={products.consumed}
        />
      )}
    </div>
  );
}

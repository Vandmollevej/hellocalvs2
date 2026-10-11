import Link from "next/link";

// Fælles sidenavigation for admin-lister (Retter, Brands, Produkter,
// Dubletter): "← Forrige", "Side X af Y", "Næste →". Knapperne er de fælles
// .hf-btn-secondary; en utilgængelig retning er den samme knap, blot
// aria-disabled (styles i globals.css).

const numberFormat = new Intl.NumberFormat("da-DK");
const buttonClass = "hf-btn-secondary hf-btn--compact hf-btn--inline";

export function AdminPagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Sider" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClass}>
          ← Forrige
        </Link>
      ) : (
        <span aria-disabled="true" className={buttonClass}>
          ← Forrige
        </span>
      )}
      <span className="hf-type-body text-text-secondary">
        Side {numberFormat.format(page)} af {numberFormat.format(pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonClass}>
          Næste →
        </Link>
      ) : (
        <span aria-disabled="true" className={buttonClass}>
          Næste →
        </span>
      )}
    </nav>
  );
}

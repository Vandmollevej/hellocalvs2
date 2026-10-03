import { redirect } from "next/navigation";

// Nye produkter oprettes kun ved scanning (docs/DECISIONS.md 2026-10-02).
// Gamle links/bogmærker til den manuelle formular sendes videre til
// stregkode-flowet; ?for=ret bevares, så Opret ret-sammenhængen holder.
export default async function FoodsNewRedirect({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>;
}) {
  const { for: forParam } = await searchParams;
  redirect(forParam === "ret" ? "/camera?mode=product&for=ret" : "/camera?mode=product");
}

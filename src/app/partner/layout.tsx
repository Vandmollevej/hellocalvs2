import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Partnerportal — Hello Cal", robots: { index: false, follow: false } };

// Partnerportalen for B2B-brugere (docs/DECISIONS.md 2026-10-02): fuld
// browserbredde uden app-skal (AppFrame undtager /partner), enkel topbjælke.
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-bg text-hf-black">
      <header className="border-b border-black/5 bg-hf-white">
        <div className="mx-auto flex h-[64px] max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link href="/partner" aria-label="Partnerportal — forside" className="shrink-0">
            <Image src="/hello-cal-logo.png" alt="Hello Cal" width={150} height={50} className="h-auto w-[120px]" priority />
          </Link>
          <span className="hf-type-small rounded-full bg-hf-tan px-3 py-1 text-text-secondary">Partnerportal</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

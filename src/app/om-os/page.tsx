import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Om Hello Cal", robots: { index: false, follow: false } };

export default function AboutPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto px-4 py-10 bg-hf-white text-hf-text">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm hover:underline text-hf-brand">← Forside</Link>
        <h1 className="mt-6 text-3xl font-semibold">Om Hello Cal</h1>
        <p className="mt-4 text-hf-text-secondary">
          Hello Cal er en dansk app til kalorie- og måltidsregistrering. Vi vil gøre det nemt at holde styr på
          mad, vand og vægt, uden reklamer og med respekt for dine data.
        </p>
        <p className="mt-4 text-hf-text-secondary">
          Kontakt: <a href="mailto:support@hellocal.io" className="hover:underline text-hf-brand">support@hellocal.io</a>
        </p>
      </div>
    </div>
  );
}

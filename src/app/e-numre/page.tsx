import type { Metadata } from "next";
import Link from "next/link";
import { AdditiveList } from "@/components/additives/AdditiveList";

export const metadata: Metadata = { title: "E-numre", robots: { index: false, follow: false } };

export default function AdditivesPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-white px-4 py-10 text-neutral-900">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm text-[#067a46] hover:underline">← Forside</Link>
        <h1 className="mt-6 text-3xl font-semibold">E-numre</h1>
        <AdditiveList />
      </div>
    </div>
  );
}

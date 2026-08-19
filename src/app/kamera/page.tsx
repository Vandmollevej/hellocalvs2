"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";

type LookupResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; name: string; kcal: number }
  | { status: "not_found" }
  | { status: "error" };

function KameraContent() {
  const params = useSearchParams();
  const mode = params.get("mode") === "maaltid" ? "maaltid" : "produkt";
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<LookupResult>({ status: "idle" });

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    setResult({ status: "loading" });
    try {
      const res = await fetch(`/api/products/lookup/${encodeURIComponent(barcode)}`);
      if (res.status === 404) {
        setResult({ status: "not_found" });
        return;
      }
      if (!res.ok) {
        setResult({ status: "error" });
        return;
      }
      const data = await res.json();
      setResult({
        status: "found",
        name: data.product.name,
        kcal: data.product.kcalPer100g,
      });
    } catch {
      setResult({ status: "error" });
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="relative flex flex-[2] flex-col items-center justify-center overflow-hidden rounded-2xl bg-hf-tan">
        {mode === "maaltid" ? (
          <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-2 border-hf-tan-dark">
            <span className="text-xs text-hf-black opacity-60">
              Placér tallerkenen her
            </span>
          </div>
        ) : (
          <div className="relative h-[170px] w-[170px]">
            <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-hf-tan-dark" />
            <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-hf-tan-dark" />
            <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-hf-tan-dark" />
            <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-hf-tan-dark" />
          </div>
        )}

        <p className="absolute top-5 left-0 right-0 text-center text-[13px] text-hf-black opacity-60">
          {mode === "maaltid" ? "Hold stille..." : "Ret billedet op..."}
        </p>
      </div>

      {mode === "produkt" && (
        <div className="rounded-2xl bg-hf-tan p-4">
          <p className="mb-2 text-xs text-hf-black opacity-70">
            Kameraet kan ikke scanne rigtige stregkoder i denne prototype —
            indtast en for at afprøve opslaget (egen database → Open Food Facts):
          </p>
          <form onSubmit={handleLookup} className="flex gap-2">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="fx 5701234567890"
              className="flex-1 rounded-full bg-hf-white px-3.5 py-2 text-sm text-hf-black outline-none"
            />
            <button className="rounded-full bg-hf-black px-4 py-2 text-xs font-bold text-hf-white">
              Slå op
            </button>
          </form>

          {result.status === "loading" && (
            <p className="mt-3 text-sm text-hf-black opacity-70">Slår op...</p>
          )}
          {result.status === "found" && (
            <p className="mt-3 text-sm font-bold text-hf-black">
              {result.name} — {result.kcal} kcal/100 g
            </p>
          )}
          {result.status === "not_found" && (
            <p className="mt-3 text-sm text-hf-black opacity-70">
              Ukendt stregkode — ville normalt starte den guidede 4-trins-tilføjelse.
            </p>
          )}
          {result.status === "error" && (
            <p className="mt-3 text-sm text-hf-black opacity-70">
              Database ikke tilgængelig i dette miljø (ingen Postgres kørende her).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function KameraPage() {
  return (
    <HfScreen title={"Kamera"}>
      <Suspense fallback={null}>
        <KameraContent />
      </Suspense>
    </HfScreen>
  );
}

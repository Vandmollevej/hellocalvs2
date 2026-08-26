"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";

type Product = {
  id: string;
  name: string;
  kcalPer100g: number;
  brand: { name: string } | null;
  imageUrl?: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; product: Product }
  | { status: "not_found" }
  | { status: "error" };

export default function TilfoejPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [amount, setAmount] = useState(100);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(async (res) => {
        if (res.status === 404) return setState({ status: "not_found" });
        if (!res.ok) return setState({ status: "error" });
        const data = await res.json();
        setState({ status: "loaded", product: data.product });
      })
      .catch(() => setState({ status: "error" }));
  }, [id]);

  async function handleAdd() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, amountGrams: amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message ?? "Kunne ikke gemme registreringen");
        return;
      }
      router.push("/");
    } catch {
      setSaveError("Kunne ikke gemme registreringen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title="Tilføj">
      <div className="flex h-full flex-col p-4">
        {state.status === "loading" && (
          <p className="text-center text-sm text-hf-black opacity-60">Henter...</p>
        )}

        {(state.status === "not_found" || state.status === "error") && (
          <div className="rounded-2xl bg-hf-tan p-4 text-center">
            <p className="text-sm text-hf-black opacity-70">
              {state.status === "not_found"
                ? "Produktet findes ikke (eksempeldata har ikke rigtige id'er i dette miljø)."
                : "Database ikke tilgængelig i dette miljø."}
            </p>
          </div>
        )}

        {state.status === "loaded" && (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-[140px] w-[140px] items-center justify-center rounded-2xl bg-hf-tan">
                {state.product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.product.imageUrl}
                    alt=""
                    className="h-full w-full object-contain p-3"
                  />
                )}
              </div>
              {state.product.brand && (
                <p className="text-xs font-medium text-hf-black opacity-60">
                  {state.product.brand.name}
                </p>
              )}
              <p className="hf-heading text-lg text-hf-black">{state.product.name}</p>
              <p className="text-sm text-hf-black opacity-70">
                {Math.round((state.product.kcalPer100g * amount) / 100)} kcal
              </p>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setAmount((a) => Math.max(10, a - 10))}
                className="h-11 w-11 rounded-full bg-hf-tan text-lg font-bold text-hf-black"
              >
                −
              </button>
              <div className="flex-1 rounded-2xl bg-hf-tan py-3 text-center text-xl font-bold text-hf-black">
                {amount} g
              </div>
              <button
                onClick={() => setAmount((a) => a + 10)}
                className="h-11 w-11 rounded-full bg-hf-tan text-lg font-bold text-hf-black"
              >
                +
              </button>
            </div>

            {saveError && (
              <p className="mb-2 text-center text-sm text-hf-black opacity-70">{saveError}</p>
            )}

            <button
              onClick={handleAdd}
              disabled={saving}
              className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-60"
            >
              {saving ? "Gemmer..." : "Tilføj"}
            </button>
          </>
        )}
      </div>
    </HfScreen>
  );
}

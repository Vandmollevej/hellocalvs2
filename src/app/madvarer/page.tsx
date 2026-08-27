"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  brand: { name: string } | null;
};

type LoadState = "loading" | "ready" | "error";

export default function MadvarerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const response = await fetch("/api/products", { signal: controller.signal });
        if (!response.ok) throw new Error("Kunne ikke hente madvarer");
        const data: { products: Product[] } = await response.json();
        setProducts(data.products);
        setState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) =>
      `${product.name} ${product.brand?.name ?? ""}`.toLowerCase().includes(normalizedQuery)
    );
  }, [products, query]);

  return (
    <HfScreen title="Madvarer">
      <div className="flex flex-col gap-3 p-4">
        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søg i madvarer"
          />
        </div>

        <div className="overflow-hidden rounded-2xl bg-hf-tan">
          {state === "loading" && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">Henter madvarer …</p>
          )}
          {state === "error" && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">
              Madvarer kunne ikke hentes lige nu
            </p>
          )}
          {state === "ready" && filtered.map((product, index) => (
            <Link
              key={product.id}
              href={`/tilfoej/${product.id}`}
              className={`flex items-center gap-2.5 px-4 py-3 ${
                index < filtered.length - 1 ? "border-b border-hf-tan-dark" : ""
              }`}
            >
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-hf-white/30">
                {product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-hf-black">{product.name}</p>
                <p className="truncate text-xs text-hf-black opacity-60">
                  {[product.brand?.name, `${Math.round(product.kcalPer100g)} kcal / 100 g`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </Link>
          ))}
          {state === "ready" && filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">
              {query.trim() ? "Ingen madvarer matcher din søgning" : "Ingen madvarer endnu"}
            </p>
          )}
        </div>
      </div>
    </HfScreen>
  );
}

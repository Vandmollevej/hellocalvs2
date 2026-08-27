"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IconApple, IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  brand: { name: string } | null;
};

type Registration = { productId: string | null };

type LoadState = "loading" | "ready" | "error";

const FAVORITES_LIMIT = 10;

function mostUsedProducts(products: Product[], registrations: Registration[]) {
  const countByProductId = new Map<string, number>();
  for (const registration of registrations) {
    if (!registration.productId) continue;
    countByProductId.set(registration.productId, (countByProductId.get(registration.productId) ?? 0) + 1);
  }

  return [...products]
    .filter((product) => countByProductId.has(product.id))
    .sort((a, b) => (countByProductId.get(b.id) ?? 0) - (countByProductId.get(a.id) ?? 0))
    .slice(0, FAVORITES_LIMIT);
}

function ProductRow({ product, isLast }: { product: Product; isLast: boolean }) {
  return (
    <Link
      href={`/tilfoej/${product.id}`}
      className={`flex items-center gap-2.5 px-4 py-3 ${isLast ? "" : "border-b border-hf-tan-dark"}`}
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
  );
}

export default function MadvarerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const [productsResponse, registrationsResponse] = await Promise.all([
          fetch("/api/products", { signal: controller.signal }),
          fetch("/api/registrations", { signal: controller.signal }),
        ]);
        if (!productsResponse.ok) throw new Error("Kunne ikke hente madvarer");
        const productsData: { products: Product[] } = await productsResponse.json();
        setProducts(productsData.products);

        if (registrationsResponse.ok) {
          const registrationsData: { registrations: Registration[] } = await registrationsResponse.json();
          setRegistrations(registrationsData.registrations);
        }

        setState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, []);

  const isSearching = query.trim().length > 0;

  const favorites = useMemo(
    () => mostUsedProducts(products, registrations),
    [products, registrations]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return products.filter((product) =>
      `${product.name} ${product.brand?.name ?? ""}`.toLowerCase().includes(normalizedQuery)
    );
  }, [products, query]);

  const visibleProducts = isSearching ? filtered : favorites;

  return (
    <HfScreen title="Madvarer" icon={<IconApple size={20} stroke={2} />}>
      <div className="flex flex-col gap-3 p-4">
        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søg i madvarer"
          />
        </div>

        {!isSearching && state === "ready" && favorites.length > 0 && (
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-hf-black opacity-60">
            Mest brugte
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-hf-tan">
          {state === "loading" && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">Henter madvarer …</p>
          )}
          {state === "error" && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">
              Madvarer kunne ikke hentes lige nu
            </p>
          )}
          {state === "ready" &&
            visibleProducts.map((product, index) => (
              <ProductRow key={product.id} product={product} isLast={index === visibleProducts.length - 1} />
            ))}
          {state === "ready" && visibleProducts.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">
              {isSearching ? "Ingen madvarer matcher din søgning" : "Ingen favoritter endnu"}
            </p>
          )}
        </div>
      </div>
    </HfScreen>
  );
}

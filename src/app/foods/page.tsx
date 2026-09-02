"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconApple, IconCamera, IconSearch } from "@tabler/icons-react";
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

function ProductRow({
  product,
  isLast,
  prefillQuery,
}: {
  product: Product;
  isLast: boolean;
  prefillQuery: string;
}) {
  return (
    <Link
      href={`/add/${product.id}${prefillQuery}`}
      className={`flex items-center gap-2.5 px-4 py-3 ${isLast ? "" : "border-b border-hf-tan-dark"}`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hf-white/30">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover object-center" />
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

function MadvarerContent() {
  const searchParams = useSearchParams();
  const prefillTime = searchParams.get("time");
  const prefillDate = searchParams.get("date");
  const prefillQuery = (() => {
    const params = new URLSearchParams();
    if (prefillTime) params.set("time", prefillTime);
    if (prefillDate) params.set("date", prefillDate);
    const query = params.toString();
    return query ? `?${query}` : "";
  })();
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
        <Link
          href="/camera?mode=hellofresh"
          className="flex items-center gap-3 rounded-2xl bg-hf-tan px-4 py-3"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-hf-green text-hf-white">
            <IconCamera size={17} stroke={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.06em] text-hf-black opacity-60">
              HelloFresh
            </span>
            <span className="block text-sm font-medium text-hf-black">Genkend din ret</span>
          </span>
        </Link>

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
              <ProductRow
                key={product.id}
                product={product}
                isLast={index === visibleProducts.length - 1}
                prefillQuery={prefillQuery}
              />
            ))}
          {state === "ready" && visibleProducts.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">
              {isSearching ? "Ingen madvarer matcher din søgning" : "Ingen favoritter endnu"}
            </p>
          )}
        </div>

        <Link href="/foods/new" className="hf-btn-secondary self-center px-4 py-2 text-xs">
          Opret nyt produkt manuelt
        </Link>

        <p className="px-1 text-center text-[10px] text-hf-black opacity-40">
          Råvaredata: Fødevaredata (frida.fooddata.dk), DTU Fødevareinstituttet
        </p>
      </div>
    </HfScreen>
  );
}

export default function FoodsPage() {
  return (
    <Suspense fallback={null}>
      <MadvarerContent />
    </Suspense>
  );
}

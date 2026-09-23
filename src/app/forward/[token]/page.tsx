"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AddForwardedItemButton } from "@/components/AddForwardedItemButton";
import { useVault } from "@/lib/vault/store";
import { openForwardLink, type OpenedForward } from "@/lib/vault/handlers/forwards";

// "Videresend ret/produkt til en ven" — modtager-siden (docs/PRIVACY.md).
// Linkets nøgle står i URL-fragmentet (#k=…) og læses kun her i browseren.
// Serveren gemmer ikke, hvem der åbner linket.
export default function ForwardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status } = useVault();
  const [opened, setOpened] = useState<OpenedForward | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    const key = new URLSearchParams(window.location.hash.slice(1)).get("k") ?? "";
    let cancelled = false;
    openForwardLink(token, key)
      .then(async (result) => {
        if (cancelled) return;
        setOpened(result);
        if (result.kind === "PRODUCT" && result.productId) {
          const res = await fetch(`/api/products/${encodeURIComponent(result.productId)}`);
          const data = (await res.json().catch(() => ({}))) as { product?: { name: string } | null };
          if (!cancelled) setProductName(data.product?.name ?? null);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Kunne ikke åbne linket."));
    return () => {
      cancelled = true;
    };
  }, [status, token]);

  if (status === "loading") return null;

  if (status !== "ready") {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="hf-type-body">Log ind for at se hvad din ven har sendt dig.</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/forward/${token}`)}`}
          className="hf-btn-primary mt-4 inline-block h-12 px-6 leading-[48px]"
        >
          Log ind
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="hf-type-body text-hf-red-dark">{error}</p>
      </div>
    );
  }

  if (!opened) return null;

  const name = opened.kind === "DISH" ? opened.payload.dish?.name ?? null : productName;
  if (!name) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="hf-type-body">Varen findes ikke længere.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-6 text-center">
      <p className="hf-type-body-sm opacity-70">{opened.payload.senderName ?? "En ven"} har sendt dig</p>
      <h1 className="hf-type-page-title mt-1">{name}</h1>
      <div className="mt-6">
        <AddForwardedItemButton token={token} forward={opened} name={name} />
      </div>
    </div>
  );
}

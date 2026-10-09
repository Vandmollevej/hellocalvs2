"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isImageFile, processLogoFile } from "@/lib/brand-logo-image";
import type { LogoClientMeta, LogoUploadItem } from "@/lib/brand-logo-upload-types";
import { assignLogoUpload } from "@/app/admin/product-database/logo-upload/actions";
import { rerunBrandLogo } from "@/app/admin/product-database/brands/actions";
import type { AdminBrandRow } from "@/lib/admin-brands";

// Brand-gitteret med "Drag n drop" til/fra (admin → Varedatabase → Brands). Når
// det er slået til, kan et billede trækkes direkte ned i et brands boks: filen
// behandles som ved Logo-upload (eget parti med tidsstempel, kan slettes igen)
// og sættes som brandets logo.

type Status = { phase: "busy" | "ok" | "error"; message?: string };

const DROP_FILE_NAME = "direkte-drop.png";

function BrandLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (!logoUrl) {
    return (
      <div className="hf-type-title flex aspect-[3/2] w-full items-center justify-center rounded-md bg-hf-tan uppercase text-text-muted" title="Intet logo">
        {name.charAt(0)}
      </div>
    );
  }
  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-md bg-hf-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt={name} loading="lazy" className="h-full w-full object-contain p-3" />
    </div>
  );
}

async function uploadLogoToBrand(file: File, brandId: string): Promise<string> {
  const processed = await processLogoFile(file, () => undefined);
  const meta: LogoClientMeta = {
    fileName: DROP_FILE_NAME,
    originalWidth: processed.originalWidth,
    originalHeight: processed.originalHeight,
    originalBytes: processed.originalBytes,
    originalType: processed.originalType,
    steps: processed.steps,
  };

  const batchResponse = await fetch("/api/admin/brand-logos/batches", { method: "POST" });
  const batchData = (await batchResponse.json().catch(() => null)) as { batch?: { id: string }; message?: string } | null;
  if (!batchResponse.ok || !batchData?.batch) throw new Error(batchData?.message ?? "Kunne ikke oprette partiet");

  const form = new FormData();
  form.set("meta", JSON.stringify(meta));
  form.set("file", processed.blob, "logo.png");
  const response = await fetch(`/api/admin/brand-logos/batches/${batchData.batch.id}/items`, { method: "POST", body: form });
  const data = (await response.json().catch(() => null)) as { item?: LogoUploadItem; message?: string } | null;
  if (!response.ok || !data?.item || !data.item.imageUrl || data.item.status === "FAILED") {
    throw new Error(data?.item?.message ?? data?.message ?? "Serveren afviste filen");
  }
  const result = await assignLogoUpload(data.item.id, brandId);
  if (!result.ok) throw new Error(result.message);
  return data.item.imageUrl;
}

export function BrandGrid({ rows, productHrefs, canEdit }: { rows: AdminBrandRow[]; productHrefs: Record<string, string>; canEdit: boolean }) {
  const router = useRouter();
  const [dragDrop, setDragDrop] = useState(false);
  const [overId, setOverId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});

  // Slået til: et slip ved siden af en boks må ikke åbne billedet i fanen.
  useEffect(() => {
    if (!dragDrop) return;
    const stop = (event: Event) => event.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, [dragDrop]);

  function rerun(brand: AdminBrandRow) {
    setStatus((current) => ({ ...current, [brand.id]: { phase: "busy", message: "Sætter i kø…" } }));
    rerunBrandLogo(brand.id)
      .then((result) =>
        setStatus((current) => ({ ...current, [brand.id]: { phase: result.ok ? "ok" : "error", message: result.message } })),
      )
      .catch(() => setStatus((current) => ({ ...current, [brand.id]: { phase: "error", message: "Kunne ikke genkøre logoet" } })));
  }

  function onDrop(event: DragEvent, brand: AdminBrandRow) {
    event.preventDefault();
    setOverId(null);
    const file = Array.from(event.dataTransfer.files).find(isImageFile);
    if (!file) {
      setStatus((current) => ({ ...current, [brand.id]: { phase: "error", message: "Ikke et billede" } }));
      return;
    }
    replaceLogo(file, brand);
  }

  function replaceLogo(file: File, brand: AdminBrandRow) {
    if (!isImageFile(file)) {
      setStatus((current) => ({ ...current, [brand.id]: { phase: "error", message: "Ikke et billede" } }));
      return;
    }
    setStatus((current) => ({ ...current, [brand.id]: { phase: "busy" } }));
    uploadLogoToBrand(file, brand.id)
      .then((imageUrl) => {
        setLogos((current) => ({ ...current, [brand.id]: imageUrl }));
        setStatus((current) => ({ ...current, [brand.id]: { phase: "ok" } }));
        router.refresh();
      })
      .catch((error: unknown) => {
        setStatus((current) => ({
          ...current,
          [brand.id]: { phase: "error", message: error instanceof Error ? error.message : "Kunne ikke gemme logoet" },
        }));
      });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-4">
        {canEdit && (
          <button
            type="button"
            role="switch"
            aria-checked={dragDrop}
            onClick={() => setDragDrop((on) => !on)}
            className={`hf-type-body hf-type-strong ${dragDrop ? "text-hf-green-dark" : "text-text-muted"}`}
          >
            Drag n drop: {dragDrop ? "on" : "off"}
          </button>
        )}
        <Link
          href="/admin/product-database/images"
          className="hf-type-body hf-control inline-flex items-center rounded-md bg-hf-green-dark px-4 text-hf-white"
        >
          Upload logoer
        </Link>
      </div>

      {rows.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rows.map((brand) => {
            const state = status[brand.id];
            return (
              <li
                key={brand.id}
                className="flex flex-col gap-1"
                onDragOver={
                  dragDrop
                    ? (event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setOverId(brand.id);
                      }
                    : undefined
                }
                onDragLeave={dragDrop ? () => setOverId((id) => (id === brand.id ? null : id)) : undefined}
                onDrop={dragDrop ? (event) => onDrop(event, brand) : undefined}
              >
                <Link
                  href={productHrefs[brand.id]}
                  draggable={false}
                  className={`flex flex-1 flex-col gap-2 hf-surface p-2 hover:border-hf-green ${overId === brand.id ? "border-hf-green-dark bg-hf-green-light" : ""}`}
                >
                  <BrandLogo name={brand.name} logoUrl={logos[brand.id] ?? brand.logoUrl} />
                  <div className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
                    <p className="hf-type-body hf-type-strong truncate text-hf-black">{brand.name}</p>
                    <p className="hf-type-small text-text-muted">
                      {brand.productCount.toLocaleString("da-DK")} vare{brand.productCount === 1 ? "" : "er"}
                    </p>
                    {state && (
                      <p className={`hf-type-small ${state.phase === "error" ? "text-hf-red-dark" : state.phase === "ok" ? "text-hf-green-dark" : "text-text-muted"}`}>
                        {state.message ?? (state.phase === "busy" ? "Gemmer logo…" : "Logo gemt")}
                      </p>
                    )}
                  </div>
                </Link>
                {canEdit && (
                  <div className="mt-1 flex gap-2">
                    <label
                      className={`hf-type-small hf-type-strong flex-1 cursor-pointer rounded-md border border-hf-tan-dark bg-hf-white px-2 py-1.5 text-center text-hf-black hover:border-hf-green ${state?.phase === "busy" ? "pointer-events-none opacity-50" : ""}`}
                    >
                      Erstat logo
                      <input
                        type="file"
                        accept="image/png,image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) replaceLogo(file, brand);
                        }}
                      />
                    </label>
                    {brand.logoUrl && (
                      <button
                        type="button"
                        disabled={state?.phase === "busy"}
                        onClick={() => rerun(brand)}
                        className="hf-type-small hf-type-strong flex-1 rounded-md border border-hf-tan-dark bg-hf-white px-2 py-1.5 text-hf-black hover:border-hf-green disabled:opacity-50"
                      >
                        Genkør logo
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

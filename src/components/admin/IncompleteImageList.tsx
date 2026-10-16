"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";
import { imageThumb } from "@/lib/image-thumb";

export type IncompleteImageRow = {
  productId: string;
  productName: string;
  brandName: string | null;
  imageUrl: string;
  flags: string[];
};

const FLAG_LABELS: Record<string, "incomplete_flag_cropped" | "incomplete_flag_hand" | "incomplete_flag_open"> = {
  CROPPED: "incomplete_flag_cropped",
  HAND: "incomplete_flag_hand",
  OPEN: "incomplete_flag_open",
};

export function IncompleteImageList({ rows, locale }: { rows: IncompleteImageRow[]; locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function dismiss(productId: string) {
    setBusy(productId);
    try {
      await fetch(`/api/admin/image-screenings/${productId}`, { method: "PATCH" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.productId} className="flex items-center gap-4 border-b border-hf-tan-dark pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageThumb(row.imageUrl, 128)} alt="" width={96} height={96} className="h-24 w-24 rounded-lg object-contain" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Link href={`/admin/products/${row.productId}`} className="hf-type-strong truncate">
              {row.productName}
            </Link>
            {row.brandName ? <span className="hf-type-caption">{row.brandName}</span> : null}
            <span className="hf-type-caption">{row.flags.map((f) => (FLAG_LABELS[f] ? t(locale, FLAG_LABELS[f]) : f)).join(", ")}</span>
          </div>
          <button
            type="button"
            className="hf-type-body rounded-lg border border-hf-tan-dark px-3 py-2 disabled:opacity-50"
            disabled={busy === row.productId}
            onClick={() => dismiss(row.productId)}
          >
            {t(locale, "incomplete_images_dismiss")}
          </button>
        </li>
      ))}
    </ul>
  );
}

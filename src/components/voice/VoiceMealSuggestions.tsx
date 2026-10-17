"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { imageThumb } from "@/lib/image-thumb";
import { SwipeableRow } from "@/components/SwipeableRow";
import { EntryDetailsSheet } from "@/components/hf/EntryDetailsSheet";
import type { VoiceItem, VoiceMealError } from "@/components/voice/useMealInterpretation";

// Tale-sidens lister, uændret, på Madvarer: "Foreslået" (Tilføj pr. række og
// "Tilføj alle forslag") og "Tilføjet" (åbner registreringen). Swipe giver
// favorit, fejlmelding og slet; en gemt vare slettes først efter bekræftelse.

type T = (key: string, params?: Record<string, string | number>) => string;

function VoiceItemRow({
  item,
  onFavorite,
  onReportError,
  onDelete,
  onAdd,
  adding = false,
  t,
}: {
  item: VoiceItem;
  onFavorite?: () => void;
  onReportError?: () => void;
  onDelete: () => void;
  onAdd?: () => void;
  adding?: boolean;
  t: T;
}) {
  const content = (
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-hf-tan">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageThumb(item.image, 128)} alt="" className="h-full w-full object-contain" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="hf-type-body hf-type-strong block truncate text-hf-black">{item.title}</span>
          {item.estimated && (
            <span className="hf-type-micro hf-type-strong flex-shrink-0 rounded-full bg-hf-cream px-1.5 py-0.5 uppercase text-hf-black opacity-70">
              {t("voice.aiEstimate")}
            </span>
          )}
        </span>
        <span className="hf-type-caption mt-1 block">{item.amountLabel}</span>
      </div>
      <span className="hf-type-caption flex-shrink-0">{item.kcal} kcal</span>
      {item.saved && <IconChevronRight size={18} className="flex-shrink-0 text-hf-black opacity-40" />}
      {!item.saved && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          aria-label={`${t("voice.addOne")}: ${item.title}`}
          className="hf-btn-secondary h-10 flex-shrink-0 px-3"
        >
          {t("voice.addOne")}
        </button>
      )}
    </div>
  );

  return (
    <SwipeableRow onFavorite={onFavorite} onReportError={onReportError} onDelete={onDelete}>
      {item.saved ? (
        <Link href={`/registration/${item.id}`} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </SwipeableRow>
  );
}

export function VoiceMealSuggestions({
  items,
  error,
  adding,
  onAdd,
  onRemove,
}: {
  items: VoiceItem[];
  error: VoiceMealError | null;
  adding: boolean;
  onAdd: (items: VoiceItem[]) => void;
  onRemove: (item: VoiceItem) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<VoiceItem | null>(null);
  const suggestedItems = items.filter((item) => !item.saved);
  const savedItems = items.filter((item) => item.saved);

  function favorite(productId: string) {
    fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }

  function deleteItem(item: VoiceItem) {
    if (item.saved) setConfirmDelete(item);
    else onRemove(item);
  }

  return (
    <>
      {error && <p className="hf-type-small text-center text-hf-red-dark">{t(`voice.error.${error}`)}</p>}

      {suggestedItems.length > 0 && (
        <section>
          <h2 className="hf-type-body hf-heading mb-1 text-hf-black">{t("voice.suggested")}</h2>
          <ul className="max-h-[45vh] overflow-y-auto overflow-x-hidden rounded-card bg-hf-tan">
            {suggestedItems.map((item) => (
              <li key={item.id} className="border-b border-hf-tan-dark last:border-b-0">
                <VoiceItemRow
                  item={item}
                  onFavorite={item.productId ? () => favorite(item.productId as string) : undefined}
                  onDelete={() => deleteItem(item)}
                  onAdd={() => onAdd([item])}
                  adding={adding}
                  t={t}
                />
              </li>
            ))}
          </ul>
          {suggestedItems.length > 1 && (
            <button type="button" onClick={() => onAdd(suggestedItems)} disabled={adding} className="hf-btn-primary mt-4 h-12 w-full px-4">
              {adding ? t("voice.adding") : t("voice.addShownItems")}
            </button>
          )}
        </section>
      )}

      {savedItems.length > 0 && (
        <section>
          <h2 className="hf-type-body hf-heading mb-1 text-hf-black">{t("voice.added")}</h2>
          <ul className="max-h-[45vh] overflow-y-auto overflow-x-hidden rounded-card bg-hf-tan">
            {savedItems.map((item) => (
              <li key={item.id} className="border-b border-hf-tan-dark last:border-b-0">
                <VoiceItemRow
                  item={item}
                  onFavorite={item.productId ? () => favorite(item.productId as string) : undefined}
                  onReportError={() => router.push(`/registration/${item.id}/report-error`)}
                  onDelete={() => deleteItem(item)}
                  t={t}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirmDelete && (
        <EntryDetailsSheet
          title={confirmDelete.title}
          rows={[
            { label: t("entrySheet.amount"), value: confirmDelete.amountLabel || `${Math.round(confirmDelete.amountGrams)} g` },
            { label: t("entrySheet.energy"), value: `${Math.round(confirmDelete.kcal)} kcal` },
          ]}
          onDelete={() => onRemove(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

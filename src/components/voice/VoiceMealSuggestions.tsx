"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SwipeableRow } from "@/components/SwipeableRow";
import { FoodRow } from "@/components/FoodRow";
import { ItemListCard, ItemListDayHeading, ItemListRow } from "@/components/hf/ItemList";
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
    <FoodRow
      image={item.image}
      title={item.title}
      subtitle={
        <p className="hf-type-caption mt-1 flex items-center gap-1.5">
          {item.estimated && (
            <span className="hf-type-micro hf-type-strong flex-shrink-0 rounded-full bg-hf-tan-dark px-1.5 py-0.5 uppercase text-hf-black">
              {t("voice.aiEstimate")}
            </span>
          )}
          <span className="truncate">{item.amountLabel}</span>
        </p>
      }
      right={
        <>
          <span className="hf-type-caption">{item.kcal} kcal</span>
          {item.saved && <IconChevronRight size={18} className="text-hf-black opacity-40" />}
          {!item.saved && onAdd && (
            <button
              type="button"
              onClick={onAdd}
              disabled={adding}
              aria-label={`${t("voice.addOne")}: ${item.title}`}
              className="hf-btn-secondary h-10 px-3"
            >
              {t("voice.addOne")}
            </button>
          )}
        </>
      }
    />
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
          <ItemListDayHeading>{t("voice.suggested")}</ItemListDayHeading>
          <div className="mt-2 max-h-[45vh] overflow-y-auto">
          <ItemListCard>
            {suggestedItems.map((item) => (
              <ItemListRow key={item.id} padded={false}>
                <VoiceItemRow
                  item={item}
                  onFavorite={item.productId ? () => favorite(item.productId as string) : undefined}
                  onDelete={() => deleteItem(item)}
                  onAdd={() => onAdd([item])}
                  adding={adding}
                  t={t}
                />
              </ItemListRow>
            ))}
          </ItemListCard>
          </div>
          {suggestedItems.length > 1 && (
            <button type="button" onClick={() => onAdd(suggestedItems)} disabled={adding} className="hf-btn-primary mt-4 h-12 w-full px-4">
              {adding ? t("voice.adding") : t("voice.addShownItems")}
            </button>
          )}
        </section>
      )}

      {savedItems.length > 0 && (
        <section>
          <ItemListDayHeading>{t("voice.added")}</ItemListDayHeading>
          <div className="mt-2 max-h-[45vh] overflow-y-auto">
          <ItemListCard>
            {savedItems.map((item) => (
              <ItemListRow key={item.id} padded={false}>
                <VoiceItemRow
                  item={item}
                  onFavorite={item.productId ? () => favorite(item.productId as string) : undefined}
                  onReportError={() => router.push(`/registration/${item.id}/report-error`)}
                  onDelete={() => deleteItem(item)}
                  t={t}
                />
              </ItemListRow>
            ))}
          </ItemListCard>
          </div>
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

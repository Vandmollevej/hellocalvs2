"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconChevronRight, IconSend } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { SwipeableRow } from "@/components/SwipeableRow";
import { FoodRow } from "@/components/FoodRow";
import { ItemListCard, ItemListDayHeading, ItemListRow } from "@/components/hf/ItemList";
import { useTranslation } from "@/i18n/LocaleProvider";
import { EntryDetailsSheet } from "@/components/hf/EntryDetailsSheet";
import { mealShareBody } from "@/lib/meal-share";
import { MealLanguagePicker } from "@/components/voice/MealLanguagePicker";
import { useMealInputLanguage } from "@/components/voice/useMealInputLanguage";

// "Indtast" afløser mikrofonen på desktop-versionen: beskrivelsen skrives i
// stedet for at tales og tolkes af samme endpoint som stemmesiden. Opbygningen
// følger stemmesiden i appen: tekstfeltet øverst, varerne listet nedenunder.
type Item = {
  id: string;
  title: string;
  kcal: number;
  amountGrams: number;
  amountLabel: string;
  protein: number;
  carbs: number;
  fat: number;
  image?: string | null;
  productId?: string | null;
  estimated?: boolean;
  /** Gemt registrering (rigtigt id fra serveren) eller endnu ikke tilføjet forslag. */
  saved: boolean;
};

type InterpretedItem = Omit<Item, "id" | "saved">;

const ITEMS_STORAGE_KEY = "hf-chat-added-items";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function loadPersistedItems(): Item[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date: string; items: Item[] };
    if (parsed.date !== todayKey()) {
      window.localStorage.removeItem(ITEMS_STORAGE_KEY);
      return [];
    }
    return parsed.items;
  } catch {
    return [];
  }
}

function ItemRow({
  item,
  estimateLabel,
  addLabel,
  disabled,
  onAdd,
  onDelete,
}: {
  item: Item;
  estimateLabel: string;
  addLabel: string;
  disabled: boolean;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const content = (
    <FoodRow
      image={item.image}
      title={item.title}
      subtitle={
        <p className="hf-type-caption mt-1 flex items-center gap-1.5">
          {item.estimated && (
            <span className="hf-type-micro hf-type-strong flex-shrink-0 rounded-full bg-hf-tan-dark px-1.5 py-0.5 uppercase text-hf-black">
              {estimateLabel}
            </span>
          )}
          <span className="truncate">{item.amountLabel}</span>
        </p>
      }
      right={
        <>
          <span className="hf-type-caption">{item.kcal} kcal</span>
          {item.saved ? (
            <IconChevronRight size={18} className="text-hf-black opacity-40" />
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={disabled}
              aria-label={`${addLabel}: ${item.title}`}
              className="hf-btn-secondary h-10 px-3"
            >
              {addLabel}
            </button>
          )}
        </>
      }
    />
  );

  return (
    <SwipeableRow onDelete={onDelete}>
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

export default function ChatPage() {
  const { t } = useTranslation();
  // Sprogflaget i venstre hjørne (samme valg som tale-siden på mobil).
  const { language, region, setLanguage } = useMealInputLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage findes først efter hydrering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(loadPersistedItems());
    setLoaded(true);
  }, []);

  // Kun tilføjede (gemte) varer huskes — dagens liste overlever et sideskift.
  useEffect(() => {
    if (!loaded) return;
    const savedItems = items.filter((item) => item.saved);
    try {
      if (savedItems.length > 0) {
        window.localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify({ date: todayKey(), items: savedItems }));
      } else {
        window.localStorage.removeItem(ITEMS_STORAGE_KEY);
      }
    } catch {
      // Privat vindue o.l. — listen huskes bare ikke.
    }
  }, [items, loaded]);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/ai/interpret-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: value, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      const interpreted = (data.items ?? []) as InterpretedItem[];
      if (interpreted.length === 0) {
        setErrorMessage(t("web.chatNothing"));
        return;
      }
      const stamp = Date.now();
      setItems((current) => [
        ...current,
        ...interpreted.map((item, index) => ({ ...item, id: `pending-${stamp}-${index}`, saved: false })),
      ]);
      setText("");
    } catch {
      setErrorMessage(t("web.chatError"));
    } finally {
      setBusy(false);
    }
  }

  // Tilføjer enten alle viste forslag eller kun den ene række (ids).
  async function addShownItems(ids?: string[]) {
    const pending = items.filter((item) => !item.saved && (!ids || ids.includes(item.id)));
    if (pending.length === 0 || isAdding) return;
    setIsAdding(true);
    setErrorMessage(null);

    const results = await Promise.all(
      pending.map(async (item) => {
        try {
          const res = await fetch("/api/registrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(item.productId
                ? { productId: item.productId, amountGrams: item.amountGrams }
                : {
                    amountGrams: item.amountGrams,
                    titleSnapshot: item.title,
                    kcalSnapshot: item.kcal,
                    proteinSnapshot: item.protein,
                    carbsSnapshot: item.carbs,
                    fatSnapshot: item.fat,
                  }),
              ...mealShareBody(),
            }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          return { pendingId: item.id, saved: { ...item, id: data.registration.id as string, saved: true } };
        } catch {
          return null;
        }
      }),
    );

    // Varer, der ikke kunne gemmes, bliver stående som forslag, så de kan prøves igen.
    const savedByPendingId = new Map<string, Item>();
    for (const result of results) {
      if (result) savedByPendingId.set(result.pendingId, result.saved);
    }
    setItems((current) => current.map((item) => savedByPendingId.get(item.id) ?? item));
    setIsAdding(false);
    if (savedByPendingId.size < pending.length) setErrorMessage(t("web.chatSaveError"));
  }

  // Et gemt indtag slettes først efter bekræftelse i info-vinduet
  // (brugerkrav 2026-10-03); et forslag, der ikke er gemt, fjernes bare.
  function deleteItem(item: Item) {
    if (item.saved) {
      setConfirmDelete(item);
      return;
    }
    setItems((current) => current.filter((existing) => existing.id !== item.id));
  }

  function deleteSavedItem(item: Item) {
    setItems((current) => current.filter((existing) => existing.id !== item.id));
    fetch(`/api/registrations/${item.id}`, { method: "DELETE" }).catch(() => {});
  }

  // Forslag og tilføjede varer står hver for sig: intet gemmes, før brugeren
  // trykker Tilføj på rækken (eller "Tilføj alle forslag" ved flere).
  const suggestedItems = items.filter((item) => !item.saved);
  const savedItems = items.filter((item) => item.saved);

  return (
    <HfScreen
      title={t("web.chatTitle")}
      hideBackButton
      leading={<MealLanguagePicker language={language} region={region} onChange={setLanguage} />}
    >
      <div className="mx-auto flex w-full flex-col px-4 pb-8 pt-4 lg:w-1/2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-start gap-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={t("web.chatIntro")}
            aria-label={t("web.chatPlaceholder")}
            className="hf-type-body flex-1 resize-none rounded-lg border border-[var(--hf-color-field-border)] px-3 py-3 text-hf-black outline-none focus:border-[var(--hf-color-field-focus)] bg-hf-white"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={t("web.chatSend")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--hf-color-action)] transition hover:bg-[var(--hf-color-action-hover)] disabled:bg-[var(--hf-color-disabled)] text-hf-white"
          >
            <IconSend size={20} stroke={1.6} />
          </button>
        </form>
        <div aria-live="polite">
          {busy && <p className="hf-type-caption mt-2">{t("web.chatThinking")}</p>}
          {errorMessage && <p className="hf-type-small mt-2 text-hf-red-dark">{errorMessage}</p>}
        </div>

        {suggestedItems.length > 0 && (
          <section className="mt-4">
            <div className="flex flex-col gap-2">
            <ItemListDayHeading>{t("web.chatSuggested")}</ItemListDayHeading>
            <ItemListCard>
              {suggestedItems.map((item) => (
                <ItemListRow key={item.id} padded={false}>
                  <ItemRow
                    item={item}
                    estimateLabel={t("voice.aiEstimate")}
                    addLabel={t("web.chatAdd")}
                    disabled={isAdding}
                    onAdd={() => void addShownItems([item.id])}
                    onDelete={() => deleteItem(item)}
                  />
                </ItemListRow>
              ))}
            </ItemListCard>
            </div>
            {suggestedItems.length > 1 && (
              <button type="button" onClick={() => void addShownItems()} disabled={isAdding} className="hf-btn-primary mt-4 h-12 w-full px-4">
                {isAdding ? t("voice.adding") : t("web.chatAddAll")}
              </button>
            )}
          </section>
        )}

        {savedItems.length > 0 && (
          <section className="mt-4">
            <div className="flex flex-col gap-2">
            <ItemListDayHeading>{t("voice.added")}</ItemListDayHeading>
            <ItemListCard>
              {savedItems.map((item) => (
                <ItemListRow key={item.id} padded={false}>
                  <ItemRow
                    item={item}
                    estimateLabel={t("voice.aiEstimate")}
                    addLabel={t("web.chatAdd")}
                    disabled={isAdding}
                    onAdd={() => void addShownItems([item.id])}
                    onDelete={() => deleteItem(item)}
                  />
                </ItemListRow>
              ))}
            </ItemListCard>
            </div>
          </section>
        )}
      </div>
      {confirmDelete && (
        <EntryDetailsSheet
          title={confirmDelete.title}
          rows={[
            { label: t("entrySheet.amount"), value: confirmDelete.amountLabel || `${Math.round(confirmDelete.amountGrams)} g` },
            { label: t("entrySheet.energy"), value: `${Math.round(confirmDelete.kcal)} kcal` },
          ]}
          onDelete={() => deleteSavedItem(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </HfScreen>
  );
}

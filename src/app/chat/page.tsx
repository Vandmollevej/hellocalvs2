"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconChevronRight, IconSend } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { EnergyChip } from "@/components/calendar/EnergyChip";
import { SwipeableRow } from "@/components/SwipeableRow";
import { useTranslation } from "@/i18n/LocaleProvider";
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
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-hf-tan">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-full w-full object-contain" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="hf-type-body hf-type-strong block truncate text-hf-black">{item.title}</span>
          {item.estimated && (
            <span className="hf-type-micro hf-type-strong flex-shrink-0 rounded-full bg-hf-tan px-1.5 py-0.5 uppercase text-hf-black opacity-70">{estimateLabel}</span>
          )}
        </span>
        <span className="hf-type-small text-text-secondary mt-1 block">{item.amountLabel}</span>
      </div>
      <EnergyChip kind="intake" value={item.kcal} className="hf-type-small flex-shrink-0 text-text-secondary" />
      {item.saved ? (
        <IconChevronRight size={18} className="flex-shrink-0 text-hf-black opacity-40" />
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          aria-label={`${addLabel}: ${item.title}`}
          className="hf-btn-secondary h-10 flex-shrink-0 px-3"
        >
          {addLabel}
        </button>
      )}
    </div>
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

  function deleteItem(item: Item) {
    setItems((current) => current.filter((existing) => existing.id !== item.id));
    if (item.saved) {
      fetch(`/api/registrations/${item.id}`, { method: "DELETE" }).catch(() => {});
    }
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
            className="hf-type-body flex-1 resize-none rounded-lg border border-[var(--hf-color-field-border)] bg-white px-3 py-3 text-hf-black outline-none focus:border-[var(--hf-color-field-focus)]"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={t("web.chatSend")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--hf-color-action)] text-white transition hover:bg-[var(--hf-color-action-hover)] disabled:bg-[var(--hf-color-disabled)]"
          >
            <IconSend size={20} stroke={1.6} />
          </button>
        </form>
        <div aria-live="polite">
          {busy && <p className="hf-type-small mt-2 text-text-secondary">{t("web.chatThinking")}</p>}
          {errorMessage && <p className="hf-type-small mt-2 text-hf-red-dark">{errorMessage}</p>}
        </div>

        {suggestedItems.length > 0 && (
          <section className="mt-4">
            <h2 className="hf-type-body hf-heading mb-1 text-hf-black">{t("web.chatSuggested")}</h2>
            <ul>
              {suggestedItems.map((item) => (
                <li key={item.id} className="border-b border-hf-tan-dark last:border-b-0">
                  <ItemRow
                    item={item}
                    estimateLabel={t("voice.aiEstimate")}
                    addLabel={t("web.chatAdd")}
                    disabled={isAdding}
                    onAdd={() => void addShownItems([item.id])}
                    onDelete={() => deleteItem(item)}
                  />
                </li>
              ))}
            </ul>
            {suggestedItems.length > 1 && (
              <button type="button" onClick={() => void addShownItems()} disabled={isAdding} className="hf-btn-primary mt-4 h-12 w-full px-4">
                {isAdding ? t("voice.adding") : t("web.chatAddAll")}
              </button>
            )}
          </section>
        )}

        {savedItems.length > 0 && (
          <section className="mt-4">
            <h2 className="hf-type-body hf-heading mb-1 text-hf-black">{t("voice.added")}</h2>
            <ul>
              {savedItems.map((item) => (
                <li key={item.id} className="border-b border-hf-tan-dark last:border-b-0">
                  <ItemRow
                    item={item}
                    estimateLabel={t("voice.aiEstimate")}
                    addLabel={t("web.chatAdd")}
                    disabled={isAdding}
                    onAdd={() => void addShownItems([item.id])}
                    onDelete={() => deleteItem(item)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </HfScreen>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LiveMicButton } from "@/components/voice/LiveMicButton";
import { LiveWaveform } from "@/components/voice/LiveWaveform";
import { MealLanguagePicker } from "@/components/voice/MealLanguagePicker";
import { useMealInputLanguage } from "@/components/voice/useMealInputLanguage";
import { useLiveSpeech } from "@/lib/use-live-speech";
import { useMealInterpretation } from "@/components/voice/useMealInterpretation";
import { VoiceMealSuggestions } from "@/components/voice/VoiceMealSuggestions";
import { defaultMealInputLanguage, readStoredMealInputLanguage, speechLangFor, type MealInputLanguageCode } from "@/lib/meal-input-language";
import { IconApple, IconCamera, IconSearch } from "@tabler/icons-react";
import { IconFavorite as IconBookmark, IconFavoriteFilled as IconBookmarkFilled } from "@/components/icons/Favorite";
import { HfScreen } from "@/components/HfScreen";
import { FoodRow } from "@/components/FoodRow";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SearchCorrectionNotice } from "@/components/hf/SearchCorrectionNotice";
import { readSearchCorrection, type SearchCorrection } from "@/lib/search-notice";
import { useConnectionMessage } from "@/lib/use-online-status";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { useIsClientRender } from "@/lib/use-client-render";
import {
  readFoodsSnapshot,
  writeFoodsSnapshot,
  type FoodsProduct as Product,
  type FoodsSnapshot,
} from "@/lib/foods-snapshot";

// Skelettet vises kun ved allerførste besøg (intet gemt øjebliksbillede) og
// først efter en kort pause, så hurtige svar ikke blinker.
const SKELETON_DELAY_MS = 300;
const SKELETON_ROWS = 3;

// Regional search ranking (2026-09-19, see docs/DECISIONS.md): autosuggest
// starts at 2 typed characters, shows a short-lived cached result instantly
// while a live re-ranked request is in flight, and reports which result was
// opened so future searches can weight it (region×hour click popularity).
const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 140;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const searchCache = new Map<string, { expiresAt: number; products: Product[] }>();

function ProductRow({
  product,
  isLast,
  prefillQuery,
  isFavorite,
  onToggleFavorite,
  onOpen,
}: {
  product: Product;
  isLast: boolean;
  prefillQuery: string;
  isFavorite: boolean;
  onToggleFavorite: (id: string, next: boolean) => void;
  onOpen?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={`px-4 ${isLast ? "" : "border-b border-hf-tan-dark"}`}>
      <Link href={`/add/${product.id}${prefillQuery}`} onClick={() => onOpen?.(product.id)} className="block">
        <FoodRow
          image={product.imageUrl}
          title={product.searchTitle ?? product.name}
          subtitle={
            <p className="hf-type-caption truncate">
              {[
                // Brandet står allerede forrest i søgeresultatets titel.
                product.searchTitle ? null : product.brand?.name,
                // Uden energitabel (nutritionMissing) er 0 kun en pladsholder.
                product.nutritionMissing
                  ? t("addProduct.nutritionUnknown")
                  : t("foods.kcalPer100g", { kcal: Math.round(product.kcalPer100g) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          }
          right={
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(product.id, !isFavorite);
              }}
              aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
              className="text-hf-green"
            >
              {isFavorite ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} />}
            </button>
          }
        />
      </Link>
    </div>
  );
}

function MadvarerContent() {
  const { t } = useTranslation();
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
  const [query, setQuery] = useState("");
  // Det friske svar gemmes med den søgning, det hører til, så det erstatter
  // cachens svar for netop den søgning, så snart det er landet.
  const [searchResults, setSearchResults] = useState<{ key: string; products: Product[] }>({ key: "", products: [] });
  const [correction, setCorrection] = useState<SearchCorrection | null>(null);
  const [exactFor, setExactFor] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLTextAreaElement>(null);

  // Mikrofonen (tidligere Tale-siden): det sagte skrives løbende i søgefeltet,
  // så listen søges og raffineres, mens man taler.
  const { language, region, setLanguage } = useMealInputLanguage();
  // spoken: søgefeltets tekst kom fra mikrofonen — så tolkes hele sætningen
  // også til forslag ("to skiver franskbrød med smør og marmelade").
  const [spoken, setSpoken] = useState(false);
  const speech = useLiveSpeech(
    useCallback((text: string) => {
      setSpoken(true);
      setQuery(text);
    }, [])
  );
  const autoStartMic = searchParams.get("mic") === "1";
  const regionRef = useRef<string | null>(null);
  useEffect(() => {
    regionRef.current = region;
  }, [region]);
  function currentMealLanguage(): MealInputLanguageCode {
    return readStoredMealInputLanguage() ?? defaultMealInputLanguage(regionRef.current);
  }
  function speechLang() {
    return speechLangFor(currentMealLanguage(), regionRef.current);
  }
  const startMic = speech.start;
  useEffect(() => {
    if (autoStartMic) startMic(speechLang());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved åbning
  }, []);
  const isListening = speech.phase === "listening";
  const meal = useMealInterpretation({ text: query, listening: isListening, spoken, language: currentMealLanguage });
  const clearPendingSuggestions = meal.clearPending;
  function startSpeech(lang: string) {
    clearPendingSuggestions();
    speech.start(lang);
  }

  // Sidste liste for den aktive profil tegnes med det samme (også ved klik i
  // bundmenuen), og den friske fra serveren erstatter den stille — ingen
  // skelet-bokse før indholdet ved hvert besøg.
  const { status: familyStatus } = useFamilyStatus();
  const activeProfileId = familyStatus?.activeProfile.id ?? null;
  const isClientRender = useIsClientRender();
  const cachedSnapshot = useMemo(
    () => (isClientRender && activeProfileId ? readFoodsSnapshot(activeProfileId) : null),
    [isClientRender, activeProfileId]
  );
  const [loadedSnapshot, setLoadedSnapshot] = useState<FoodsSnapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const connectionMessage = useConnectionMessage();
  const snapshot =
    loadedSnapshot && (!activeProfileId || loadedSnapshot.profileId === activeProfileId)
      ? loadedSnapshot
      : cachedSnapshot;
  const [skeletonDue, setSkeletonDue] = useState(false);
  const waiting = snapshot === null && !loadFailed;

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setSkeletonDue(true), SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        // Varer og bogmærker hentes samlet, så rækkerne ikke først tegnes
        // med tomme bogmærker, der derefter fyldes ud.
        const [productsResponse, favoritesResponse] = await Promise.all([
          fetch("/api/products/most-used", { signal: controller.signal }),
          fetch("/api/favorites", { signal: controller.signal }).catch(() => null),
        ]);
        if (!productsResponse.ok) throw new Error("Kunne ikke hente madvarer");
        const data = (await productsResponse.json()) as { profileId: string; products: Product[] };

        let favoriteIds: string[] | null = null;
        if (favoritesResponse?.ok) {
          const favoritesData = (await favoritesResponse.json()) as {
            favorites: Array<{ product: { id: string } | null }>;
          };
          favoriteIds = favoritesData.favorites.flatMap((favorite) => (favorite.product ? [favorite.product.id] : []));
        }

        const next: FoodsSnapshot = {
          profileId: data.profileId,
          products: data.products,
          favoriteIds: favoriteIds ?? readFoodsSnapshot(data.profileId)?.favoriteIds ?? [],
        };
        setLoadedSnapshot(next);
        writeFoodsSnapshot(next);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setLoadFailed(true);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const favoriteIds = useMemo(() => new Set(snapshot?.favoriteIds ?? []), [snapshot]);

  function toggleFavorite(productId: string, next: boolean) {
    if (snapshot) {
      const ids = new Set(snapshot.favoriteIds);
      if (next) ids.add(productId);
      else ids.delete(productId);
      const updated = { ...snapshot, favoriteIds: [...ids] };
      setLoadedSnapshot(updated);
      writeFoodsSnapshot(updated);
    }
    fetch("/api/favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }

  useEffect(() => {
    if (!autoStartMic) searchInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved åbning
  }, []);

  // Søgefeltet vokser i højden, når teksten (fx det sagte) ikke kan stå på én linje.
  useEffect(() => {
    const field = searchInputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [query]);

  const normalizedQuery = query.trim();
  const isSearching = normalizedQuery.length >= SEARCH_MIN_LENGTH;

  // Cached results for the current query render instantly (no setState —
  // this is a plain derived read of the module-level cache), while the
  // effect below revalidates live and only calls setState from its
  // asynchronous fetch callback.
  // Freshness (TTL) is only checked where a timestamp read is allowed to be
  // impure — inside the effect below, not here. A render past its TTL is
  // corrected within SEARCH_DEBOUNCE_MS by the live revalidation anyway.
  const cachedResults = useMemo(() => {
    if (normalizedQuery.length < SEARCH_MIN_LENGTH) return null;
    return searchCache.get(normalizedQuery.toLocaleLowerCase())?.products ?? null;
  }, [normalizedQuery]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_LENGTH) return;

    const cacheKey = q.toLocaleLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt <= Date.now()) searchCache.delete(cacheKey);
    const hadCacheHit = searchCache.has(cacheKey);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const hour = new Date().getHours();
        const response = await fetch(
          `/api/products?q=${encodeURIComponent(q)}&hour=${hour}&take=20${exactFor === q ? "&exact=1" : ""}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as {
          products: Product[];
          correctedQuery?: string;
          originalQuery?: string;
          suggestedQuery?: string;
        };
        const info = readSearchCorrection(data, q);
        setCorrection(info);
        // Rettede/foreslåede svar caches ikke, så cachen aldrig viser forkert linje.
        if (!info) {
          searchCache.set(cacheKey, {
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
            products: data.products,
          });
        }
        setSearchResults({ key: cacheKey, products: data.products });
      } catch (error) {
        if ((error as Error).name !== "AbortError" && !hadCacheHit) {
          setSearchResults({ key: cacheKey, products: [] });
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, exactFor]);

  function trackSearchClick(productId: string) {
    if (query.trim().length < SEARCH_MIN_LENGTH) return;
    const payload = JSON.stringify({
      productId,
      localHour: new Date().getHours(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/products/search-event", new Blob([payload], { type: "application/json" }));
      return;
    }

    void fetch("/api/products/search-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }

  // Favoritter øverst (brugerens krav 2026-10-16) — serveren sender dem
  // først, og et nyt bogmærke rykker straks op uden at vente på næste hentning.
  const favorites = useMemo(() => {
    const products = snapshot?.products ?? [];
    return [...products.filter((p) => favoriteIds.has(p.id)), ...products.filter((p) => !favoriteIds.has(p.id))];
  }, [snapshot, favoriteIds]);
  const ready = snapshot !== null;

  // Below the minimum, `searchResults` may still hold the last real query's
  // results — masked here rather than reset from an effect body (avoids a
  // synchronous setState-in-effect; the state is simply irrelevant while
  // isSearching is false and gets overwritten by the next real query anyway).
  // While searching, prefer the cached instant result until the live,
  // re-ranked fetch for this exact query has actually landed — then the live
  // one wins (before, a cached answer stuck for as long as the page lived).
  const liveIsCurrent = searchResults.key === normalizedQuery.toLocaleLowerCase();
  const visibleProducts = isSearching
    ? liveIsCurrent
      ? searchResults.products
      : cachedResults ?? searchResults.products
    : favorites;

  return (
    <HfScreen
      title={t("foods.title")}
      icon={<IconApple size={20} stroke={2} />}
    >
      <div className="hf-page">
        <section className="relative flex flex-col items-center" aria-live="polite">
          {/* Sprogflaget står til venstre for mikrofonen, ud for listens
              venstre kant — spejlet af favoritmærket til højre (brugerens
              ønske 2026-10-16: ikke oppe i headeren, væk fra mikrofonen). */}
          <div className="absolute left-0 top-[26px]">
            <MealLanguagePicker
              language={language}
              region={region}
              onChange={(code) => {
                if (code === language) return;
                setLanguage(code);
                if (isListening) startSpeech(speechLangFor(code, region));
              }}
            />
          </div>
          <LiveMicButton
            listening={isListening}
            unsupported={speech.phase === "unsupported"}
            label={t(isListening ? "voice.stopMic" : "voice.startMic")}
            onClick={() => (isListening ? speech.stop() : startSpeech(speechLang()))}
          />
          <p className="hf-type-small hf-type-strong mt-2 text-hf-green">
            {isListening ? t("voice.listeningStatus") : speech.phase === "unsupported" ? t("voice.unsupported") : t("voice.tapToTalk")}
          </p>
          <LiveWaveform active={isListening} />
          {speech.error && (
            <p className="hf-type-small mt-2 max-w-[310px] text-center text-hf-red-dark">
              {t(
                speech.error === "denied"
                  ? "voice.error.micDenied"
                  : speech.error === "noSpeech"
                    ? "voice.error.noSpeechCloser"
                    : speech.error === "couldNotStart"
                      ? "voice.error.micCouldNotStart"
                      : "voice.error.recognitionInterrupted",
              )}
            </p>
          )}
        </section>

        <div className="hf-search hf-search--grow">
          {/* Kameraet i søgefeltet åbner billedfunktionen (afløser knappen "Scan nyt produkt" nederst). */}
          <Link href="/camera?mode=product" aria-label={t("foods.scanNewProduct")} className="shrink-0 text-hf-green">
            <IconCamera size={22} stroke={1.8} />
          </Link>
          <textarea
            ref={searchInputRef}
            rows={1}
            value={query}
            onChange={(event) => {
              if (isListening) speech.stop();
              if (spoken) {
                setSpoken(false);
                clearPendingSuggestions();
              }
              setQuery(event.target.value.replace(/\s*\n\s*/g, " "));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            enterKeyHint="search"
            placeholder={t("foods.searchPlaceholder")}
          />
          <IconSearch size={16} color="var(--hf-black)" className="shrink-0" />
        </div>

        <VoiceMealSuggestions
          suggestions={meal.suggestions}
          interpreting={meal.interpreting}
          failed={meal.failed}
          adding={meal.adding}
          onAdd={meal.add}
          onRemove={meal.remove}
        />

        {isSearching && correction?.forQuery === normalizedQuery && (
          <SearchCorrectionNotice
            correction={correction}
            onSearchExact={() => setExactFor(normalizedQuery)}
            onUseSuggestion={setQuery}
          />
        )}

        {!isSearching && ready && favorites.length > 0 && (
          <p className="hf-type-caption hf-type-strong px-1 uppercase tracking-[0.08em]">
            {t("foods.mostUsed")}
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden bg-hf-tan rounded-card">
          {waiting && skeletonDue && (
            <SkeletonScreen className="px-4">
              <SkeletonMediaRows rows={SKELETON_ROWS} />
            </SkeletonScreen>
          )}
          {!ready && loadFailed && (
            <p className="hf-type-body text-text-secondary px-4 py-8 text-center">
              {connectionMessage(t("foods.loadError"))}
            </p>
          )}
          {ready &&
            visibleProducts.map((product, index) => (
              <ProductRow
                key={product.id}
                product={product}
                isLast={index === visibleProducts.length - 1}
                prefillQuery={prefillQuery}
                isFavorite={favoriteIds.has(product.id)}
                onToggleFavorite={toggleFavorite}
                onOpen={isSearching ? trackSearchClick : undefined}
              />
            ))}
          {ready && visibleProducts.length === 0 && meal.suggestions.length === 0 && !meal.interpreting && (
            <p className="hf-type-body text-text-secondary px-4 py-8 text-center">
              {isSearching ? t("foods.noSearchMatches") : t("foods.noFavoritesYet")}
            </p>
          )}
        </div>
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

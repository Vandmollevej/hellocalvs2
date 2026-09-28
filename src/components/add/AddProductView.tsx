"use client";

import { mealShareBody } from "@/lib/meal-share";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconChevronDown,
  IconBookmark,
  IconBookmarkFilled,
  IconAlertTriangle,
  IconLock,
  IconLockOpen,
  IconRefresh,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { MealShareBar } from "@/components/family/MealShareBar";
import { ForwardButton } from "@/components/ForwardButton";
import { appendDishDraftIngredient } from "@/lib/dish-draft";
import { selectRawContextImageUrl } from "@/lib/image-tags";
import { MacroSliderBar } from "@/components/hf/MacroSliderBar";
import { CertificationLogos } from "@/components/hf/CertificationLogos";
import { certificationBadges, type CertificationFilters } from "@/lib/certification-badges";
import { AdditiveInfoModal } from "@/components/hf/AdditiveInfoModal";
import { getAdditiveInfo, splitENumbers } from "@/lib/additives";
import { IngredientsText } from "@/components/hf/IngredientsText";
import { labelForAllergen } from "@/lib/allergens";
import { matchToxins, type ToxinInfo } from "@/lib/toxins";
import { ToxinInfoModal } from "@/components/hf/ToxinInfoModal";
import { useTranslation } from "@/i18n/LocaleProvider";
import { isAlternativeServingConfident } from "@/lib/alternative-servings";
import type { AlternativeServing } from "@/lib/product-analysis-types";
import { fromDisplayAmount, getProductDisplayUnit, toDisplayAmount } from "@/lib/product-display-unit";
import { NUTRIENT_BY_KEY, type ResolvedNutrient } from "@/lib/nutrients";
import { UncertaintyTilde } from "@/components/ui/UncertaintyTilde";
import { UncertaintyLine } from "@/components/ui/UncertaintyLine";
import { extractCertifications } from "@/lib/product-certifications";
import { CertificationLogo } from "@/components/hf/CertificationLogo";
import { Skeleton, SkeletonDetail, SkeletonScreen } from "@/components/hf/Skeleton";

// "Opret straks" (docs/DECISIONS.md 2026-09-27): mens OpenAI stadig læser
// felter (Product.pendingFields), eller den fritlagte forside endnu ikke er
// klar, hentes varen igen med dette interval.
const PENDING_POLL_MS = 2500;
// Så længe efter oprettelsen ventes der på den fritlagte forside.
const CUTOUT_WAIT_MS = 3 * 60 * 1000;

// Felter, OpenAI stadig læser, tegnes som skelet-flader med den løbende
// gradient (design.md §6.14) i stedet for load-cirkler; skærmlæsere hører
// "Læser…".
function ReadingSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span role="status" aria-busy="true" className="inline-flex max-w-full flex-col items-center gap-2 align-middle">
      <span className="sr-only">{label}</span>
      {children}
    </span>
  );
}

const PHOTO_AWARD_TYPE_KEY: Record<string, "photoAward.photoTypeBarcode" | "photoAward.photoTypeNutrition" | "photoAward.photoTypeIngredients"> = {
  BARCODE: "photoAward.photoTypeBarcode",
  NUTRITION: "photoAward.photoTypeNutrition",
  INGREDIENTS: "photoAward.photoTypeIngredients",
};

function currentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatDaNumber(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

function currentDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Product = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeGrams?: number | null;
  servingSizeUnitSingular?: string | null;
  servingSizeUnitPlural?: string | null;
  brand: { name: string; logoUrl?: string | null } | null;
  // Produktkategori + pakningsstørrelse bestemmer mængdeenheden (drikkevare =
  // ml/cl, ellers g), se src/lib/product-display-unit.ts.
  productCategory?: string | null;
  packageSizeText?: string | null;
  variant?: string | null;
  imageUrl?: string | null;
  // Fritlagt forside, der venter på admin-godkendelse — vises kun for den,
  // der selv oprettede varen (docs/DECISIONS.md 2026-09-27).
  pendingImageUrl?: string | null;
  // Felter OpenAI stadig læser ("name" | "brand" | "nutrition" | "ingredients").
  pendingFields?: string[];
  createdAt?: string;
  // Tagged image variants (Multiple/Raw), see src/lib/image-tags.ts and
  // docs/DECISIONS.md 2026-09-19. Empty when the product/ingredient has no
  // tagged alternates.
  images?: { url: string; tags: string[] }[];
  ingredientsText?: string | null;
  allergens?: string[];
  additives?: string[];
  // Mærkninger (økologisk, nøglehul, MSC …) vist som logoer, opgave 29.
  filters?: CertificationFilters | null;
  barcodes?: { code: string }[];
  createdByUserId?: string | null;
  // HelloFresh-recipe extra nutrition, per Product.servingSizeGrams — see
  // docs/DECISIONS.md 2026-08-29/2026-09-10.
  nutritionExtra?: Record<string, number> | null;
  // MyFitnessPal-style extended panel (2026-09-11), per 100g — currently only
  // populated for products sourced from Open Food Facts.
  saturatedFatPer100g?: number | null;
  unsaturatedFatPer100g?: number | null;
  transFatPer100g?: number | null;
  cholesterolPer100g?: number | null;
  vitaminAPer100g?: number | null;
  vitaminCPer100g?: number | null;
  // Alternative kalorievisninger fra emballagen (per glas/skive/stk. osv.),
  // se docs/DECISIONS.md 2026-09-19 — kun vist når AI'en var sikker nok.
  alternativeServings?: AlternativeServing[] | null;
  // Generisk, ikke-scannet ingrediens (grønt/frugt/kød uden brand, se
  // docs/DECISIONS.md 2026-09-19) — flag sat af /api/products/[id]'s fallback
  // til GenericIngredient. Bruges kun til at vælge registrerings-feltet
  // (genericIngredientId i stedet for productId) og skjule favorit-knappen,
  // som ikke understøtter ingredienser endnu.
  isGenericIngredient?: boolean;
  hasKnownNutrition?: boolean;
  // Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): alle næringsstoffer ud
  // over makroerne pr. 100 g fra /api/products/[id], med estimeret-flag.
  nutrients?: ResolvedNutrient[];
};

type ProfileUser = {
  id: string;
  showAllergens: boolean;
  allergenVisibility: Record<string, boolean> | null;
  showExtendedNutrition: boolean;
  // Indstillinger → Visning → Usikkerhed: fold de grå linjer ud automatisk.
  autoExpandUncertainty?: boolean;
  showAdditives: boolean;
  showToxins: boolean;
};

// Mættet fedt og transfedt får en advarselstrekant (G11, 56f30763).
const UNHEALTHY_FAT_KEYS = new Set(["saturatedFat", "transFat"]);

// En allerede tilføjet registrering, der redigeres (/registration/[id]).
export type EditableRegistration = {
  id: string;
  titleSnapshot: string;
  kcalSnapshot: number;
  proteinSnapshot: number;
  carbsSnapshot: number;
  fatSnapshot: number;
  amountGrams: number;
  createdAt: string;
};

// Snapshot-semantik (docs/DATABASE.md): ved redigering regnes kalorier og
// makroer ud fra registreringens egne snapshot-værdier pr. 100 g — aldrig fra
// varens nuværende data, som kan være ændret siden.
function applyRegistrationSnapshot(product: Product, registration: EditableRegistration | undefined): Product {
  if (!registration || registration.amountGrams <= 0) return product;
  const per100g = (value: number) => (value / registration.amountGrams) * 100;
  return {
    ...product,
    kcalPer100g: per100g(registration.kcalSnapshot),
    proteinPer100g: per100g(registration.proteinSnapshot),
    carbsPer100g: per100g(registration.carbsSnapshot),
    fatPer100g: per100g(registration.fatSnapshot),
  };
}

// Registreringer uden vare (egne retter) får en vare bygget af snapshottet.
function productFromRegistration(registration: EditableRegistration): Product {
  return applyRegistrationSnapshot(
    {
      id: "",
      name: registration.titleSnapshot,
      kcalPer100g: 0,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 0,
      brand: null,
      isGenericIngredient: true,
    },
    registration,
  );
}

function localTimeString(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; product: Product }
  | { status: "not_found" }
  | { status: "error" };

// "Tilføj produkt": mængde, tidspunkt, energifordeling og næringsindhold.
// Vises som egen side (/add/[id]) og — når man trykker "Tilføj" ud for et
// produkt i søgelisten — i bundarket (inSheet, KRAV.md "Bundark").
// Med `registration` redigeres en allerede tilføjet registrering i stedet
// (/registration/[id]); id er da varens id, eller "" for en egen ret.
export function AddProductView({
  id,
  forDish,
  initialTime,
  initialDate,
  inSheet = false,
  onClose,
  registration,
}: {
  id: string;
  forDish: boolean;
  initialTime?: string | null;
  initialDate?: string | null;
  inSheet?: boolean;
  onClose?: () => void;
  registration?: EditableRegistration;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const isEditing = Boolean(registration);
  const [state, setState] = useState<LoadState>(() =>
    !id && registration
      ? { status: "loaded", product: productFromRegistration(registration) }
      : { status: "loading" },
  );
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [amount, setAmount] = useState(() => registration?.amountGrams ?? 100);
  // Standard skal altid være gram (Fejlretninger/FEJLLISTE.md #1/#22): "personer"
  // er kun en mulighed, når varen faktisk har en defineret portionsstørrelse,
  // og må ikke være default-valget selv når den findes.
  const [amountUnit, setAmountUnit] = useState<"personer" | "gram">("gram");
  const [time] = useState(
    () => (registration ? localTimeString(new Date(registration.createdAt)) : initialTime) ?? currentTimeString(),
  );
  const [date] = useState(
    () => (registration ? localDateString(new Date(registration.createdAt)) : initialDate) ?? currentDateString(),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openAdditive, setOpenAdditive] = useState<string | null>(null);
  // Åben som standard (G11, 2026-09-24) — brugeren har selv slået panelet til.
  const [extendedNutritionOpen, setExtendedNutritionOpen] = useState(true);
  const [toxinsOpen, setToxinsOpen] = useState(false);
  const [openToxin, setOpenToxin] = useState<ToxinInfo | null>(null);
  // Rækker hvor brugeren selv har vendt den grå usikkerhedslinje i forhold
  // til udgangspunktet (profilens autoExpandUncertainty).
  const [uncertaintyToggled, setUncertaintyToggled] = useState<Set<string>>(() => new Set());
  const [additiveNames, setAdditiveNames] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): åbne Awards
  // brugeren kan optjene points ved at indsende et bedre billede af dette
  // produkt. Aldrig vist for et produkt uden nogen enabled+OPEN award.
  const [photoAwards, setPhotoAwards] = useState<{ id: string; photoType: string; points: number }[]>([]);
  const [macroOverride, setMacroOverride] = useState<{
    amount: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  // UI-only edit lock (docs/DECISIONS.md 2026-09-22): energifordeling starts
  // read-only on every page load; the snapshot taken at unlock is what the
  // reset button restores. Never persisted.
  const [isProductEditingUnlocked, setIsProductEditingUnlocked] = useState(false);
  const [macroOverrideSnapshot, setMacroOverrideSnapshot] = useState<typeof macroOverride>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.user ?? null))
      .catch(() => setProfile(null));

    // Egen ret uden vare: state er allerede sat fra snapshottet.
    if (!id && registration) return;

    fetch(`/api/products/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (registration) return setState({ status: "loaded", product: productFromRegistration(registration) });
          return setState({ status: "not_found" });
        }
        if (!res.ok) return setState({ status: "error" });
        const data = await res.json();
        setState({ status: "loaded", product: applyRegistrationSnapshot(data.product, registration) });
        // Dishes with a fixed serving size (e.g. HelloFresh, see
        // scripts/hellofresh-import) are counted in servings, not grams — start
        // at 1 serving instead of the usual 100 g default.
        if (!registration && data.product?.servingSizeGrams) setAmount(data.product.servingSizeGrams);
      })
      .catch(() => setState({ status: "error" }));

    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data) => {
        const favorites = (data.favorites ?? []) as { product: { id: string } | null }[];
        setIsFavorite(favorites.some((favorite) => favorite.product?.id === id));
      })
      .catch(() => setIsFavorite(false));

    fetch(`/api/products/${id}/photo-awards`)
      .then((res) => res.json())
      .then((data) => setPhotoAwards(data.awards ?? []))
      .catch(() => setPhotoAwards([]));
  }, [id, registration]);

  // Tidspunktet siden blev åbnet — ventetiden på fritlægning måles fra det.
  const [openedAt] = useState(() => Date.now());
  const pendingFields = state.status === "loaded" ? (state.product.pendingFields ?? []) : [];
  const isPending = (field: "name" | "brand" | "nutrition" | "ingredients") => pendingFields.includes(field);
  const ownProduct =
    state.status === "loaded" && !!profile?.id && state.product.createdByUserId === profile.id;
  const awaitingCutout =
    ownProduct &&
    state.status === "loaded" &&
    !state.product.pendingImageUrl &&
    !!state.product.createdAt &&
    openedAt - new Date(state.product.createdAt).getTime() < CUTOUT_WAIT_MS;
  const shouldPoll = pendingFields.length > 0 || awaitingCutout;

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = setTimeout(() => {
      fetch(`/api/products/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.product) return;
          setState((current) =>
            current.status === "loaded"
              ? { status: "loaded", product: applyRegistrationSnapshot({ ...data.product }, registration) }
              : current,
          );
        })
        .catch(() => {});
    }, PENDING_POLL_MS);
    return () => clearTimeout(timer);
  }, [shouldPoll, state, id, registration]);

  async function handleToggleFavorite() {
    if (favoritePending) return;
    const next = !isFavorite;
    setIsFavorite(next);
    setFavoritePending(true);
    try {
      await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });
    } catch {
      setIsFavorite(!next);
    } finally {
      setFavoritePending(false);
    }
  }

  const product = state.status === "loaded" ? state.product : null;
  // Når varen tilføjes til en opskrift/ret (for=ret), vis den rå-varen
  // (Multiple/Raw-tags, se src/lib/image-tags.ts) i stedet for
  // standardbilledet, som ofte viser det tilberedte/emballerede produkt.
  const displayImageUrl = product
    ? forDish
      ? selectRawContextImageUrl(product.imageUrl, product.images)
      : (product.pendingImageUrl && product.createdByUserId && product.createdByUserId === profile?.id
          ? product.pendingImageUrl
          : (product.imageUrl ?? null))
    : null;
  const factor = amount / 100;
  const servingSizeGrams = product?.servingSizeGrams ?? null;
  // Enheden ("portion"/"portioner", "person"/"personer" osv.) vises kun når
  // varen faktisk har den i databasen — UI må ikke gætte en generisk enhed
  // (se design.md-diskussion 2026-09-08).
  const servingSizeUnitSingular = product?.servingSizeUnitSingular ?? null;
  const servingSizeUnitPlural = product?.servingSizeUnitPlural ?? null;
  const hasServingUnit = Boolean(servingSizeGrams && servingSizeUnitSingular && servingSizeUnitPlural);
  const step = servingSizeGrams && amountUnit === "personer" ? servingSizeGrams : 10;
  // Enheden følger produktets registrerede kategori og skifter aldrig ved
  // +/−; amount er altid i basisenheden (g/ml), cl er kun visning.
  const displayUnit = getProductDisplayUnit(product);
  const displayAmount = toDisplayAmount(amount, displayUnit);
  const baseUnitLabel =
    displayUnit === "cl"
      ? t("addProduct.centilitresUnit")
      : displayUnit === "ml"
        ? t("addProduct.millilitresUnit")
        : t("addProduct.gramsUnit");

  useEffect(() => {
    const codes = product?.additives ?? [];
    if (!codes.length) return;
    let cancelled = false;
    Promise.all(codes.map((code) => getAdditiveInfo(code))).then((results) => {
      if (cancelled) return;
      setAdditiveNames((prev) => {
        const next = { ...prev };
        results.forEach((info, index) => {
          next[codes[index]] = info.internationalName || codes[index];
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [product?.additives]);

  const defaultMacros = useMemo(
    () =>
      product
        ? {
            protein: Math.round(product.proteinPer100g * factor * 10) / 10,
            carbs: Math.round(product.carbsPer100g * factor * 10) / 10,
            fat: Math.round(product.fatPer100g * factor * 10) / 10,
          }
        : { protein: 0, carbs: 0, fat: 0 },
    [product, factor]
  );

  // Overrides only apply to the amount they were set at — if the amount changes,
  // the bars automatically follow the computed default values again.
  const macros = macroOverride && macroOverride.amount === amount ? macroOverride : defaultMacros;

  // Alternative kalorievisninger fra emballagen (per glas/skive/stk. osv.,
  // docs/DECISIONS.md 2026-09-19), vist under standard-Per-100g-tallet — kun
  // dem AI'en var sikker nok på; usikre fund vises aldrig som fakta her, de
  // går i stedet til admin (se src/lib/alternative-servings-review.ts).
  const confidentAlternativeServings = useMemo(
    () => (product?.alternativeServings ?? []).filter(isAlternativeServingConfident),
    [product],
  );

  // MyFitnessPal-style extended nutrition panel (2026-09-11): saturated/
  // unsaturated/trans fat, cholesterol, and vitamin A/C are real per-100g
  // Product fields (Open Food Facts-sourced products only), scaled by the
  // current amount just like the macro bars above. Sugar/fiber/salt/
  // potassium/calcium/iron come from Product.nutritionExtra instead, which is
  // per the product's own servingSizeGrams, not per 100g (see
  // scripts/hellofresh-import/agent.py) — only scaled when that's known.
  const extendedNutrition = useMemo(() => {
    if (!product) return [];
    const extraFactor = product.servingSizeGrams ? amount / product.servingSizeGrams : null;
    const extra = product.nutritionExtra ?? null;
    const fromExtra = (key: string) =>
      extraFactor !== null && extra && typeof extra[key] === "number" ? extra[key] * extraFactor : null;
    const fromPer100g = (value: number | null | undefined) =>
      typeof value === "number" ? value * factor : null;

    // Opløste næringsstoffer fra serveren (varedeklaration/Frida/estimat) —
    // de gamle felter nedenfor er kun fallback for et ældre API-svar.
    if (product.nutrients?.length) {
      return product.nutrients.map((n) => {
        const def = NUTRIENT_BY_KEY[n.key];
        return {
          key: n.key,
          value: n.per100g * factor,
          unit: def.unit,
          digits: def.digits,
          estimated: n.estimated,
          tolerance: n.tolerancePer100g !== null ? n.tolerancePer100g * factor : null,
          label: t(`addProduct.nutrient.${n.key}`),
        };
      });
    }

    const rows: { key: string; value: number | null; unit: string; digits?: number }[] = [
      { key: "saturatedFat", value: fromPer100g(product.saturatedFatPer100g), unit: "g", digits: 1 },
      { key: "unsaturatedFat", value: fromPer100g(product.unsaturatedFatPer100g), unit: "g", digits: 1 },
      { key: "transFat", value: fromPer100g(product.transFatPer100g), unit: "g", digits: 2 },
      { key: "cholesterol", value: fromPer100g(product.cholesterolPer100g), unit: "mg" },
      { key: "sodium", value: fromExtra("saltG"), unit: "g", digits: 1 },
      { key: "potassium", value: fromExtra("potassiumMg"), unit: "mg" },
      { key: "fiber", value: fromExtra("fiberG"), unit: "g", digits: 1 },
      { key: "sugar", value: fromExtra("sugarG"), unit: "g", digits: 1 },
      { key: "vitaminA", value: fromPer100g(product.vitaminAPer100g), unit: "µg" },
      { key: "vitaminC", value: fromPer100g(product.vitaminCPer100g), unit: "mg" },
      { key: "calcium", value: fromExtra("calciumMg"), unit: "mg" },
      { key: "iron", value: fromExtra("ironMg"), unit: "mg", digits: 1 },
    ];

    return rows
      .filter((row): row is { key: string; value: number; unit: string; digits?: number } => row.value !== null)
      .map((row) => ({
        ...row,
        estimated: false,
        tolerance: null as number | null,
        label: t(`addProduct.nutrient.${row.key}`),
      }));
  }, [product, amount, factor, t]);

  const visibleAllergens = useMemo(() => {
    if (!product?.allergens?.length || !profile?.showAllergens) return [];
    return product.allergens.filter(
      (key) => !profile.allergenVisibility || profile.allergenVisibility[key] !== false
    );
  }, [product, profile]);

  const toxinMatches = useMemo(
    () => (product && profile?.showToxins ? matchToxins(product.name, product.ingredientsText) : []),
    [product, profile?.showToxins]
  );

  function handleToggleEditLock() {
    if (!isProductEditingUnlocked) setMacroOverrideSnapshot(macroOverride);
    setIsProductEditingUnlocked((unlocked) => !unlocked);
  }

  function scrollToDetails() {
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleAdd() {
    setSaving(true);
    setSaveError(null);
    try {
      const [year, month, day] = date.split("-").map(Number);
      const [hours, minutes] = time.split(":").map(Number);
      const createdAt = new Date(year, month - 1, day, hours, minutes, 0, 0);

      if (registration) {
        const res = await fetch(`/api/registrations/${registration.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountGrams: amount,
            createdAt: createdAt.toISOString(),
            kcalSnapshot: ((product?.kcalPer100g ?? 0) * amount) / 100,
            proteinSnapshot: macros.protein,
            carbsSnapshot: macros.carbs,
            fatSnapshot: macros.fat,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSaveError(data.message ?? t("registration.saveError"));
          return;
        }
        if (window.history.length > 1) router.back();
        else router.push("/");
        return;
      }

      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(product?.isGenericIngredient ? { genericIngredientId: id } : { productId: id }),
          amountGrams: amount,
          createdAt: createdAt.toISOString(),
          proteinSnapshot: macros.protein,
          carbsSnapshot: macros.carbs,
          fatSnapshot: macros.fat,
          // Fælles måltid (docs/FAMILY.md).
          ...mealShareBody(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message ?? t("addProduct.saveError"));
        return;
      }
      router.push("/");
    } catch {
      setSaveError(t("addProduct.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function handleAddToDish() {
    if (!product) return;
    appendDishDraftIngredient({
      productId: product.id,
      name: product.name,
      // Tilberedning/opskrift viser rå-varen, når et "Raw"-tagget billede
      // findes, i stedet for standardbilledet (som ofte er det tilberedte/
      // emballerede produkt) — se src/lib/image-tags.ts.
      imageUrl: selectRawContextImageUrl(product.imageUrl, product.images),
      kcalPer100g: product.kcalPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      grams: amount,
    });
    router.push("/create-dish");
  }

  const { title: productTitle, certifications } =
    state.status === "loaded" ? extractCertifications(state.product.name) : { title: "", certifications: [] };

  const title = forDish ? t("addProduct.titleForDish") : t("addProduct.title");
  const Frame = inSheet ? SheetFrame : ScreenFrame;

  return (
    <Frame
      title={title}
      onClose={onClose}
      footer={
        state.status === "loaded" ? (
          <>
            {!forDish && !isEditing && (
              <div className="mb-4">
                <MealShareBar />
              </div>
            )}
            {saveError && (
              <p className="hf-type-body text-text-secondary mb-2 text-center">{saveError}</p>
            )}
            <button
              onClick={forDish ? handleAddToDish : handleAdd}
              disabled={saving}
              className="hf-control hf-btn-primary w-full disabled:opacity-60"
            >
              {forDish
                ? t("addProduct.addToDish")
                : saving
                  ? t("createDish.saving")
                  : isEditing
                    ? t("registration.save")
                    : t("addProduct.add")}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex h-full flex-col overflow-y-auto">
        {state.status === "loading" && (
          <SkeletonScreen>
            <SkeletonDetail />
          </SkeletonScreen>
        )}

        {(state.status === "not_found" || state.status === "error") && (
          <div className="m-4 rounded-2xl bg-hf-tan p-4 text-center">
            <p className="hf-type-body text-text-secondary">
              {state.status === "not_found"
                ? t("addProduct.notFound")
                : t("addProduct.error")}
            </p>
          </div>
        )}

        {state.status === "loaded" && (
          <>
            {!forDish && !!id && photoAwards.length > 0 && (
              <Link
                href={`/add/${id}/photo-award`}
                className="hf-type-small hf-type-strong hf-control flex items-center justify-center bg-hf-black px-4 text-center text-hf-white"
              >
                {photoAwards.length === 1
                  ? t("photoAward.bannerSingle", {
                      points: photoAwards[0].points,
                      photoType: t(PHOTO_AWARD_TYPE_KEY[photoAwards[0].photoType]),
                    })
                  : t("photoAward.bannerMultiple", {
                      points: photoAwards.reduce((sum, award) => sum + award.points, 0),
                    })}
              </Link>
            )}
            <div className="relative flex flex-col p-4">
              {/* Del-knappen ligger oven på hjørnet, så cirklen står 16 px under
                  headeren – samme afstand som mellem sektionerne. */}
              {!forDish && !!id && (
                <div className="absolute right-4 top-2 z-20">
                  <ForwardButton kind="PRODUCT" itemId={state.product.id} name={state.product.name} />
                </div>
              )}
              <div className="flex flex-col items-start gap-2 text-left">
                <div className="relative self-center h-[190px] w-[190px] min-h-[190px] min-w-[190px] max-h-[190px] max-w-[190px] shrink-0 overflow-visible">
                  <div className="flex h-[190px] w-[190px] min-h-[190px] min-w-[190px] items-center justify-center overflow-hidden rounded-full bg-hf-tan">
                    {displayImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayImageUrl}
                        alt=""
                        className="block h-full w-full max-h-full max-w-full object-cover"
                      />
                    ) : shouldPoll ? (
                      <Skeleton type="circle" width="100%" height="100%" />
                    ) : (
                      <div aria-hidden="true" className="h-full w-full" />
                    )}
                  </div>
                  {!state.product.isGenericIngredient && (
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
                      className="hf-favorite-button"
                    >
                      {isFavorite ? <IconBookmarkFilled size={24} /> : <IconBookmark size={24} />}
                    </button>
                  )}
                  {/* Brandet vises kun på cirklen: logoet med bunden i cirklens
                      bund og venstre kant 3/4 inde; uden logo brandnavnet i
                      fed grøn tekst samme sted (DECISIONS 2026-09-28). */}
                  {state.product.brand &&
                    (state.product.brand.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={state.product.brand.logoUrl}
                        alt={state.product.brand.name}
                        className="pointer-events-none absolute bottom-0 left-3/4 z-10 h-[95px] w-[95px] object-contain object-left-bottom"
                      />
                    ) : (
                      <p className="hf-type-title hf-type-strong pointer-events-none absolute bottom-0 left-3/4 z-10 whitespace-nowrap text-hf-green">
                        {state.product.brand.name}
                      </p>
                    ))}
                  {/* Certificeringslogoer (Øko m.fl.) på produktcirklen; uden
                      certificering vises intet logo (docs/DECISIONS.md 2026-09-28). */}
                  {certifications.length > 0 && (
                    <div className="pointer-events-none absolute bottom-2 left-0 z-10 flex gap-1">
                      {certifications.map((certification) => (
                        <CertificationLogo key={certification} certification={certification} />
                      ))}
                    </div>
                  )}
                </div>
                {isPending("name") ? (
                  <ReadingSkeleton label={t("addProduct.reading")}>
                    <Skeleton type="body-lg" width={200} />
                  </ReadingSkeleton>
                ) : (
                  <h1 className="hf-type-page-title text-hf-black">{productTitle}</h1>
                )}
                {(state.product.packageSizeText || state.product.variant) && (
                  <h2 className="hf-type-title hf-type-strong text-hf-green">
                    {[state.product.packageSizeText, state.product.variant].filter(Boolean).join(" · ")}
                  </h2>
                )}
              </div>

              <button
                type="button"
                onClick={scrollToDetails}
                className="hf-btn-text flex items-center gap-1 self-center mb-4 font-normal text-hf-black"
              >
                {t("addProduct.details")}
                <IconChevronDown size={15} />
              </button>

              {hasServingUnit && (
                <div className="mb-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountUnit("personer")}
                    className={
                      amountUnit === "personer"
                        ? "hf-btn-primary px-4 py-1.5"
                        : "hf-btn-secondary px-4 py-1.5"
                    }
                  >
                    <span className="capitalize">{servingSizeUnitPlural}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountUnit("gram")}
                    className={
                      amountUnit === "gram"
                        ? "hf-btn-primary px-4 py-1.5"
                        : "hf-btn-secondary px-4 py-1.5"
                    }
                  >
                    {baseUnitLabel}
                  </button>
                </div>
              )}

              <div className="mx-auto mb-4 flex w-full max-w-[320px] items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmount((a) => Math.max(step, a - step))}
                  className="h-11 w-11 text-[34px] font-bold leading-none text-hf-black"
                >
                  −
                </button>
                <div className="flex-1 rounded-2xl bg-hf-tan py-3 text-center text-hf-black">
                  {hasServingUnit && amountUnit === "personer" ? (
                    <p className="hf-type-page-title capitalize">
                      {`${Math.round(amount / (servingSizeGrams as number))} ${
                        amount === servingSizeGrams ? servingSizeUnitSingular : servingSizeUnitPlural
                      }`}
                    </p>
                  ) : (
                    <label className="hf-type-page-title flex items-baseline justify-center text-hf-black">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={displayUnit === "cl" ? 1 : 10}
                        step={displayUnit === "cl" ? 1 : 10}
                        value={displayAmount}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isFinite(value)) setAmount(Math.max(0, fromDisplayAmount(value, displayUnit)));
                        }}
                        style={{ width: `${Math.max(1, String(displayAmount).length) + 0.5}ch` }}
                        className="bg-transparent text-right outline-none"
                      />
                      <span>&nbsp;{displayUnit}</span>
                    </label>
                  )}
                  <p className="hf-type-body text-text-secondary flex justify-center">
                    {isPending("nutrition") ? (
                      <ReadingSkeleton label={t("addProduct.reading")}>
                        <Skeleton type="caption" width={64} height={14} className="my-0.5" />
                      </ReadingSkeleton>
                    ) : state.product.isGenericIngredient && state.product.hasKnownNutrition === false
                      ? t("addProduct.nutritionUnknown")
                      : t("addProduct.kcalAmount", { kcal: Math.round((state.product.kcalPer100g * amount) / 100) })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAmount((a) => a + step)}
                  className="h-11 w-11 text-[34px] font-bold leading-none text-hf-black"
                >
                  +
                </button>
              </div>

              <div className="-mt-2 mb-4 flex flex-col items-center text-center">
                <p className="hf-type-body hf-type-strong text-hf-black">
                  {isPending("nutrition") ? (
                    <ReadingSkeleton label={t("addProduct.reading")}>
                      <Skeleton type="body" width={150} />
                    </ReadingSkeleton>
                  ) : state.product.isGenericIngredient && state.product.hasKnownNutrition === false
                    ? t("addProduct.nutritionUnknown")
                    : servingSizeGrams && hasServingUnit
                    ? t("addProduct.kcalPerServing", {
                        kcal: Math.round((state.product.kcalPer100g * servingSizeGrams) / 100),
                        unit: servingSizeUnitSingular as string,
                      })
                    : displayUnit === "g"
                    ? t("addProduct.kcalPer100g", { kcal: Math.round(state.product.kcalPer100g) })
                    : t("addProduct.kcalPer100ml", { kcal: Math.round(state.product.kcalPer100g) })}
                </p>
                {!!confidentAlternativeServings.length && (
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    {confidentAlternativeServings.map((serving: AlternativeServing, index: number) => (
                      <p key={`${serving.label}-${index}`} className="hf-type-small text-text-secondary">
                        {t("addProduct.alternativeServing", { label: serving.label, kcal: Math.round(serving.kcal as number) })}
                      </p>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div ref={detailsRef} className="flex flex-col gap-8 border-t border-hf-tan-dark p-4">
              {profile?.showAdditives && !!state.product.additives?.length && (
                <section
                  aria-labelledby="product-additives-heading"
                  className="rounded-2xl border-2 border-hf-green bg-hf-tan p-4"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-hf-green text-[30px] font-bold leading-none text-hf-white"
                    >
                      E
                    </span>
                    <div className="flex flex-col">
                      <h2 id="product-additives-heading" className="hf-type-title hf-type-strong text-hf-black">
                        {t("addProduct.additives")}
                      </h2>
                      <p className="hf-type-small hf-type-strong flex items-center gap-1 text-hf-black">
                        <IconAlertTriangle size={16} className="shrink-0" />
                        {t("addProduct.additivesWarning")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    {state.product.additives.map((code, index) => {
                      const name = additiveNames[code] ?? code.toUpperCase();
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setOpenAdditive(code)}
                          className={`hf-control-row flex items-center gap-3 text-left ${
                            index < (state.product.additives?.length ?? 0) - 1
                              ? "border-b border-hf-tan-dark"
                              : ""
                          }`}
                        >
                          <span className="hf-type-small hf-type-strong text-hf-black">{code.toUpperCase()}</span>
                          <span className="hf-type-small text-text-secondary underline underline-offset-2">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="hf-type-title hf-type-strong text-hf-black">{t("common.macroBreakdown")}</h2>
                  <div className="-my-3 -mr-3 flex items-center">
                    {isProductEditingUnlocked && (
                      <button
                        type="button"
                        onClick={() => setMacroOverride(macroOverrideSnapshot)}
                        aria-label={t("addProduct.resetChanges")}
                        className="hf-btn-icon text-hf-black"
                      >
                        <IconRefresh size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleEditLock}
                      aria-label={t(isProductEditingUnlocked ? "addProduct.lockEditing" : "addProduct.unlockEditing")}
                      aria-pressed={isProductEditingUnlocked}
                      className="hf-btn-icon text-hf-black"
                    >
                      {isProductEditingUnlocked ? <IconLockOpen size={20} /> : <IconLock size={20} />}
                    </button>
                  </div>
                </div>
                {isPending("nutrition") ? (
                  <div role="status" aria-busy="true" className="flex flex-col gap-4">
                    <span className="sr-only">{t("addProduct.reading")}</span>
                    {["22%", "36%", "18%"].map((width) => (
                      <div key={width} aria-hidden>
                        <div className="mb-2 flex items-center justify-between">
                          <Skeleton type="body-sm" width={width} height={18} />
                          <Skeleton type="body" width={44} height={20} />
                        </div>
                        <Skeleton type="row" height={8} className="my-1.5" style={{ borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="flex flex-col gap-4">
                  <MacroSliderBar
                    label={t("common.protein")}
                    grams={macros.protein}
                    max={Math.max(30, Math.ceil(defaultMacros.protein * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, protein: value })}
                    disabled={!isProductEditingUnlocked}
                  />
                  <MacroSliderBar
                    label={t("common.carbs")}
                    grams={macros.carbs}
                    max={Math.max(40, Math.ceil(defaultMacros.carbs * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, carbs: value })}
                    disabled={!isProductEditingUnlocked}
                  />
                  <MacroSliderBar
                    label={t("common.fat")}
                    grams={macros.fat}
                    max={Math.max(20, Math.ceil(defaultMacros.fat * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, fat: value })}
                    disabled={!isProductEditingUnlocked}
                  />
                </div>
                )}
                <CertificationLogos badges={certificationBadges(state.product.filters)} className="mt-4" />
              </div>

              {/* Toksiner (G11): kendte stoffer ud fra navn + indholdsfortegnelse,
                  kun når brugeren har slået det til i Opsætning. */}
              {!!toxinMatches.length && (
                <div>
                  <button
                    type="button"
                    onClick={() => setToxinsOpen((open) => !open)}
                    className="mb-3 flex w-full items-center justify-between"
                  >
                    <p className="hf-type-body hf-heading text-hf-black">{t("addProduct.toxins")}</p>
                    <IconChevronDown
                      size={18}
                      className={`text-hf-black transition-transform ${toxinsOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {toxinsOpen && (
                    <div className="flex flex-col overflow-hidden rounded-2xl bg-hf-tan">
                      {toxinMatches.map(({ toxin, matchedTerm }, index) => (
                        <button
                          key={toxin.key}
                          type="button"
                          onClick={() => setOpenToxin(toxin)}
                          className={`flex items-center gap-3 px-4 py-3 text-left ${
                            index < toxinMatches.length - 1 ? "border-b border-hf-tan-dark" : ""
                          }`}
                        >
                          <IconAlertTriangle size={18} className="shrink-0 text-hf-black" />
                          <span className="hf-type-small text-text-secondary flex-1">
                            <span className="underline underline-offset-2">{toxin.name}</span>{" "}
                            ({matchedTerm})
                          </span>
                          {(toxin.pregnancy || toxin.fertility) && (
                            <span className="hf-type-micro shrink-0 rounded-full bg-hf-white px-2 py-0.5 text-hf-black">
                              {t("addProduct.toxinPregnancyBadge")}
                            </span>
                          )}
                        </button>
                      ))}
                      <p className="hf-type-micro text-text-secondary px-4 py-2.5">
                        {t("addProduct.toxinsDisclaimer")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!!visibleAllergens.length && (
                <div>
                  <p className="hf-type-body hf-heading mb-2 flex items-center gap-2 text-hf-black">
                    <span className="hf-type-small hf-type-strong flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hf-green text-hf-white">
                      !
                    </span>
                    {t("addProduct.allergens")}
                  </p>
                  <p className="hf-type-small text-text-secondary">
                    {visibleAllergens.map((key) => labelForAllergen(key)).join(", ")}
                  </p>
                  <p className="hf-type-micro text-text-secondary mt-2">
                    {t("addProduct.allergenDisclaimer")}
                  </p>
                </div>
              )}

              {(isPending("ingredients") || !!state.product.ingredientsText) && (
                <div>
                  <p className="hf-type-body mb-2 text-hf-black">{t("createDish.ingredients")}</p>
                  {isPending("ingredients") ? (
                    <div role="status" aria-busy="true" className="flex flex-col gap-2">
                      <span className="sr-only">{t("addProduct.reading")}</span>
                      {["94%", "82%", "88%", "46%"].map((width) => (
                        <Skeleton key={width} type="body-sm" width={width} height={16} />
                      ))}
                    </div>
                  ) : (
                    <p className="hf-type-small text-text-secondary">
                      {splitENumbers(state.product.ingredientsText ?? "").map((part, index) =>
                        part.code ? (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setOpenAdditive(part.code as string)}
                            className="hf-type-strong text-hf-black underline underline-offset-2"
                          >
                            {part.text}
                          </button>
                        ) : (
                          <IngredientsText key={index} text={part.text} />
                        ),
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* MyFitnessPal-style extended nutrition panel (2026-09-11): only
                  shown when the user opted in (profile/settings) AND at least
                  one value actually exists for this product — never renders
                  as an empty block. Collapsed by default behind "Vis mere". */}
              {profile?.showExtendedNutrition && !!extendedNutrition.length && (
                <div>
                  <button
                    type="button"
                    onClick={() => setExtendedNutritionOpen((open) => !open)}
                    className="flex w-full items-center justify-between"
                  >
                    <p className="hf-type-body hf-heading text-hf-black">{t("addProduct.extendedNutrition")}</p>
                    <span className="hf-type-small hf-type-strong flex items-center gap-1 text-hf-black underline underline-offset-2">
                      {extendedNutritionOpen ? t("addProduct.showLess") : t("addProduct.showMore")}
                      <IconChevronDown
                        size={15}
                        className={`transition-transform ${extendedNutritionOpen ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>
                  {extendedNutritionOpen && (
                    <div className="mt-4 flex flex-col overflow-hidden rounded-2xl bg-hf-tan">
                      {extendedNutrition.map((row, index) => {
                        // Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): ~ vises
                        // altid ved estimerede værdier; den grå linje er foldet
                        // ind, medmindre brugeren har slået automatisk udfoldning
                        // til — et tryk på rækken vender det.
                        const hasUncertainty = row.estimated || (row.tolerance ?? 0) > 0;
                        const expanded =
                          hasUncertainty &&
                          Boolean(profile?.autoExpandUncertainty) !== uncertaintyToggled.has(row.key);
                        const rowClass = `hf-type-small flex w-full flex-wrap items-center justify-between px-4 py-2.5 text-left text-hf-black ${
                          index < extendedNutrition.length - 1 ? "border-b border-hf-tan-dark" : ""
                        }`;
                        const content = (
                          <>
                            <span className="flex items-center gap-1">
                              {UNHEALTHY_FAT_KEYS.has(row.key) && (
                                <IconAlertTriangle size={15} className="shrink-0" aria-label={t("addProduct.unhealthyFat")} />
                              )}
                              <span className="opacity-70">{row.label}</span>
                              {hasUncertainty && (
                                <IconChevronDown
                                  size={13}
                                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                              )}
                            </span>
                            <span className="hf-type-strong">
                              {row.estimated && <UncertaintyTilde />}
                              {formatDaNumber(row.value, row.digits ?? 0)} {row.unit}
                            </span>
                            {expanded && (
                              <UncertaintyLine
                                className="mt-1 w-full text-right"
                                estimated={row.estimated ? row.value : null}
                                tolerance={row.tolerance}
                                unit={row.unit}
                                digits={row.digits ?? 0}
                              />
                            )}
                          </>
                        );
                        return hasUncertainty ? (
                          <button
                            key={row.key}
                            type="button"
                            className={rowClass}
                            aria-expanded={expanded}
                            onClick={() =>
                              setUncertaintyToggled((current) => {
                                const next = new Set(current);
                                if (next.has(row.key)) next.delete(row.key);
                                else next.add(row.key);
                                return next;
                              })
                            }
                          >
                            {content}
                          </button>
                        ) : (
                          <div key={row.key} className={rowClass}>
                            {content}
                          </div>
                        );
                      })}
                      <p className="hf-type-micro text-text-secondary px-4 py-2.5">
                        {t("addProduct.extendedNutritionDisclaimer")}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!!state.product.barcodes?.length && state.product.createdByUserId !== profile?.id && (
                <Link
                  href={`/profile/report-bug?productId=${id}`}
                  className="hf-button hf-button--primary mt-2 flex items-center justify-center gap-2"
                >
                  <IconAlertTriangle size={18} />
                  {t("addProduct.reportBug")}
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      {openAdditive && (
        <AdditiveInfoModal code={openAdditive} onClose={() => setOpenAdditive(null)} />
      )}
      {openToxin && <ToxinInfoModal toxin={openToxin} onClose={() => setOpenToxin(null)} />}
    </Frame>
  );
}

type FrameProps = {
  title: string;
  footer?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
};

function ScreenFrame({ title, footer, children }: FrameProps) {
  return (
    <HfScreen title={title} footer={footer}>
      {children}
    </HfScreen>
  );
}

// Bundark-rammen med samme props som HfScreen (titel, indhold, fast bund).
function SheetFrame({ title, footer, onClose, children }: FrameProps) {
  return (
    <BottomSheet title={title} footer={footer} size="full" onClose={() => onClose?.()}>
      {children}
    </BottomSheet>
  );
}

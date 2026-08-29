"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { appendDishDraftIngredient } from "@/lib/dish-draft";
import { MacroSliderBar } from "@/components/hf/MacroSliderBar";
import { AdditiveInfoModal } from "@/components/hf/AdditiveInfoModal";
import { getAdditiveInfo } from "@/lib/additives";
import { labelForAllergen } from "@/lib/allergens";

function currentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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
  brand: { name: string } | null;
  imageUrl?: string | null;
  ingredientsText?: string | null;
  allergens?: string[];
  additives?: string[];
};

type ProfileUser = {
  showAllergens: boolean;
  allergenVisibility: Record<string, boolean> | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; product: Product }
  | { status: "not_found" }
  | { status: "error" };

export default function TilfoejPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [amount, setAmount] = useState(100);
  const [time, setTime] = useState(() => searchParams.get("time") ?? currentTimeString());
  const [date] = useState(() => searchParams.get("date") ?? currentDateString());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openAdditive, setOpenAdditive] = useState<string | null>(null);
  const [additiveNames, setAdditiveNames] = useState<Record<string, string>>({});
  const [macroOverride, setMacroOverride] = useState<{
    amount: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(async (res) => {
        if (res.status === 404) return setState({ status: "not_found" });
        if (!res.ok) return setState({ status: "error" });
        const data = await res.json();
        setState({ status: "loaded", product: data.product });
        // Retter med en fast portionsstørrelse (fx HelloFresh, se
        // scripts/hellofresh-import) tælles i portioner, ikke gram — start på
        // 1 portion i stedet for den almindelige 100 g-standard.
        if (data.product?.servingSizeGrams) setAmount(data.product.servingSizeGrams);
      })
      .catch(() => setState({ status: "error" }));

    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.user ?? null))
      .catch(() => setProfile(null));
  }, [id]);

  const product = state.status === "loaded" ? state.product : null;
  const factor = amount / 100;
  const servingSizeGrams = product?.servingSizeGrams ?? null;
  const step = servingSizeGrams ? servingSizeGrams / 2 : 10;

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

  // Overstyringer gælder kun for den mængde, de blev sat ved — ændres mængden,
  // følger bjælkerne automatisk igen med de udregnede standardværdier.
  const macros = macroOverride && macroOverride.amount === amount ? macroOverride : defaultMacros;

  const visibleAllergens = useMemo(() => {
    if (!product?.allergens?.length || !profile?.showAllergens) return [];
    return product.allergens.filter(
      (key) => !profile.allergenVisibility || profile.allergenVisibility[key] !== false
    );
  }, [product, profile]);

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

      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: id,
          amountGrams: amount,
          createdAt: createdAt.toISOString(),
          proteinSnapshot: macros.protein,
          carbsSnapshot: macros.carbs,
          fatSnapshot: macros.fat,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message ?? "Kunne ikke gemme registreringen");
        return;
      }
      router.push("/");
    } catch {
      setSaveError("Kunne ikke gemme registreringen");
    } finally {
      setSaving(false);
    }
  }

  function handleAddToDish() {
    if (!product) return;
    appendDishDraftIngredient({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      kcalPer100g: product.kcalPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      grams: amount,
    });
    router.push("/opret-ret");
  }

  return (
    <HfScreen title={forDish ? "Tilføj ingrediens" : "Tilføj"}>
      <div className="flex h-full flex-col overflow-y-auto">
        {state.status === "loading" && (
          <p className="p-4 text-center text-sm text-hf-black opacity-60">Henter...</p>
        )}

        {(state.status === "not_found" || state.status === "error") && (
          <div className="m-4 rounded-2xl bg-hf-tan p-4 text-center">
            <p className="text-sm text-hf-black opacity-70">
              {state.status === "not_found"
                ? "Produktet findes ikke (eksempeldata har ikke rigtige id'er i dette miljø)."
                : "Database ikke tilgængelig i dette miljø."}
            </p>
          </div>
        )}

        {state.status === "loaded" && (
          <>
            <div className="flex flex-col p-4">
              <div className="flex flex-col items-center gap-2 pt-2 text-center">
                <div className="flex h-[190px] w-[190px] items-center justify-center rounded-2xl bg-hf-tan">
                  {state.product.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.product.imageUrl}
                      alt=""
                      className="h-full w-full object-contain p-3"
                    />
                  )}
                </div>
                {state.product.brand && (
                  <p className="text-xs font-medium text-hf-black opacity-60">
                    {state.product.brand.name}
                  </p>
                )}
                <p className="hf-heading text-lg text-hf-black">{state.product.name}</p>
                <p className="text-sm font-bold text-hf-black">
                  {servingSizeGrams
                    ? `${Math.round((state.product.kcalPer100g * servingSizeGrams) / 100)} kcal / portion`
                    : `${Math.round(state.product.kcalPer100g)} kcal/100g`}
                </p>

                <div className="mt-2 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={scrollToDetails}
                    className="flex items-center gap-1 text-[13px] font-medium text-hf-black underline underline-offset-2"
                  >
                    Detaljer
                    <IconChevronDown size={15} />
                  </button>

                  {!!state.product.additives?.length && (
                    <button
                      type="button"
                      onClick={scrollToDetails}
                      className="flex items-center gap-1.5 text-[13px] text-hf-black opacity-70"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-hf-green text-[10px] font-bold text-hf-white">
                        E
                      </span>
                      <span className="underline underline-offset-2">E-tilsætningsstoffer</span>
                    </button>
                  )}
                </div>
              </div>

              {!forDish && (
                <div className="mb-3 mt-6 flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3">
                  <span className="text-sm font-medium text-hf-black opacity-70">Tidspunkt</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="bg-transparent text-right text-sm font-bold text-hf-black"
                  />
                </div>
              )}

              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => setAmount((a) => Math.max(step, a - step))}
                  className="h-11 w-11 rounded-full bg-hf-tan text-lg font-bold text-hf-black"
                >
                  −
                </button>
                <div className="flex-1 rounded-2xl bg-hf-tan py-3 text-center text-hf-black">
                  <p className="text-xl font-bold">
                    {servingSizeGrams
                      ? `${(amount / servingSizeGrams).toLocaleString("da-DK", { maximumFractionDigits: 1 })} ${amount === servingSizeGrams ? "portion" : "portioner"}`
                      : `${amount} g`}
                  </p>
                  <p className="text-xs opacity-70">
                    {Math.round((state.product.kcalPer100g * amount) / 100)} kcal
                  </p>
                </div>
                <button
                  onClick={() => setAmount((a) => a + step)}
                  className="h-11 w-11 rounded-full bg-hf-tan text-lg font-bold text-hf-black"
                >
                  +
                </button>
              </div>

              {saveError && (
                <p className="mb-2 text-center text-sm text-hf-black opacity-70">{saveError}</p>
              )}

              <button
                onClick={forDish ? handleAddToDish : handleAdd}
                disabled={saving}
                className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-60"
              >
                {forDish ? "Tilføj til ret" : saving ? "Gemmer..." : "Tilføj"}
              </button>
            </div>

            <div ref={detailsRef} className="flex flex-col gap-6 border-t border-hf-tan-dark p-4">
              <div>
                <p className="hf-heading mb-4 text-[15px] text-hf-black">Energifordeling</p>
                <div className="flex flex-col gap-4">
                  <MacroSliderBar
                    label="Protein"
                    grams={macros.protein}
                    max={Math.max(30, Math.ceil(defaultMacros.protein * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, protein: value })}
                  />
                  <MacroSliderBar
                    label="Kulhydrat"
                    grams={macros.carbs}
                    max={Math.max(40, Math.ceil(defaultMacros.carbs * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, carbs: value })}
                  />
                  <MacroSliderBar
                    label="Fedt"
                    grams={macros.fat}
                    max={Math.max(20, Math.ceil(defaultMacros.fat * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, fat: value })}
                  />
                </div>
              </div>

              {!!state.product.additives?.length && (
                <div>
                  <p className="hf-heading mb-3 text-[15px] text-hf-black">E-tilsætningsstoffer</p>
                  <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
                    {state.product.additives.map((code, index) => {
                      const name = additiveNames[code] ?? code.toUpperCase();
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setOpenAdditive(code)}
                          className={`flex items-center gap-3 px-4 py-3 text-left ${
                            index < (state.product.additives?.length ?? 0) - 1
                              ? "border-b border-hf-tan-dark"
                              : ""
                          }`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hf-green text-[11px] font-bold text-hf-white">
                            E
                          </span>
                          <span className="text-[13px] text-hf-black opacity-70">
                            ({code.toUpperCase()}){" "}
                            <span className="underline underline-offset-2">{name}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!!visibleAllergens.length && (
                <div>
                  <p className="hf-heading mb-2 text-[15px] text-hf-black">Allergener</p>
                  <p className="text-[13px] text-hf-black opacity-70">
                    {visibleAllergens.map((key) => labelForAllergen(key)).join(", ")}
                  </p>
                  <p className="mt-2 text-[11px] text-hf-black opacity-50">
                    Vi henter data fra 3. part og fraskriver os ansvar for manglende data.
                  </p>
                </div>
              )}

              {!!state.product.ingredientsText && (
                <div>
                  <p className="hf-heading mb-2 text-[15px] text-hf-black">Ingredienser</p>
                  <p className="text-[13px] leading-relaxed text-hf-black opacity-70">
                    {state.product.ingredientsText}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {openAdditive && (
        <AdditiveInfoModal code={openAdditive} onClose={() => setOpenAdditive(null)} />
      )}
    </HfScreen>
  );
}

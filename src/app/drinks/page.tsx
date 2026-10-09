"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconGlassCocktail } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { DrinkDto } from "@/lib/drinks";

function DrinksContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [drinks, setDrinks] = useState<DrinkDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/drinks")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { drinks: DrinkDto[] };
      })
      .then((data) => setDrinks(data.drinks))
      .catch(() => setDrinks([]))
      .finally(() => setLoading(false));
  }, []);

  // Dato/tid fra kalenderens "Tilføj" føres videre til drinkens side.
  const context = new URLSearchParams();
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  if (date) context.set("date", date);
  if (time) context.set("time", time);
  const suffix = context.toString() ? `?${context.toString()}` : "";

  return (
    <HfScreen title={t("drinks.title")} icon={<IconGlassCocktail size={20} stroke={2} />}>
      <div className="hf-page">
        {loading && (
          <SkeletonScreen className="flex flex-col gap-2">
            <SkeletonCards count={4} height={96} radius={16} />
          </SkeletonScreen>
        )}
        {!loading && drinks.length === 0 && (
          <p className="hf-type-small text-text-secondary text-center">{t("drinks.noDrinksYet")}</p>
        )}
        {drinks.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {drinks.map((drink) => (
              <Link
                key={drink.id}
                href={`/drinks/${drink.id}${suffix}`}
                className="items-center text-hf-black hf-card"
              >
                <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-hf-cream">
                  {drink.imageUrl ? (
                    <Image src={drink.imageUrl} alt="" width={96} height={96} className="h-full w-full object-cover" />
                  ) : (
                    <IconGlassCocktail size={36} stroke={1.5} />
                  )}
                </span>
                <span className="hf-type-small hf-type-strong text-center">{drink.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </HfScreen>
  );
}

export default function DrinksPage() {
  return (
    <Suspense fallback={null}>
      <DrinksContent />
    </Suspense>
  );
}

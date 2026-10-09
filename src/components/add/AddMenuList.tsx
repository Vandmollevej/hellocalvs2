"use client";

import Image from "next/image";
import Link from "next/link";
import { MealShareBar } from "@/components/family/MealShareBar";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { useAddActionsProfile, visibleAddActions } from "@/lib/add-actions";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Tilføj"-menuen: 3D-ikon-felter (2 kolonner på mobil, 5 på bredere
// skærme) i det beige kort. Vises af AddMenuSheet (forsidehjulets "Se alle"
// og kalenderens "Tilføj" på en time) og af /add/menu; arket scroller, når
// felterne ikke kan være der. Aktivitet og menstruation er felter som resten
// (ejerens valg 2026-10-03); menstruation kun for kvinder med cyklus slået
// til, via visibleAddActions(). Målvægt vises ikke her.
//
// date/time (kalenderens tilfælde) sendes videre på hver href som ekstra
// query-parametre, så /foods lander registreringen på det valgte klokkeslæt.
const TILES = [
  { key: "food", href: "/search", icon: "/icons/add/food.webp" },
  { key: "scan", href: "/camera?mode=product", icon: "/icons/add/scan.webp" },
  { key: "platePhoto", href: "/camera?mode=meal", icon: "/icons/add/plate-photo.webp" },
  { key: "dish", href: "/create-dish", icon: "/icons/add/dish.webp" },
  { key: "voice", href: "/voice", icon: "/icons/add/voice.webp" },
  { key: "weight", href: "/weight/create", icon: "/icons/add/weight.webp" },
  { key: "drink", href: "/water/create", icon: "/icons/add/drink.webp" },
  { key: "body", href: "/profile/body-measurements", icon: "/icons/add/body.webp" },
  { key: "activity", href: "/activity/create", icon: "/icons/activity-3d.png" },
  { key: "period", href: "/period/create", icon: "/icons/add/period.svg", requiresCycleTracking: true },
] as const;

export function AddMenuList({ date, time }: { date?: string | null; time?: string | null }) {
  const { t } = useTranslation();
  const profile = useAddActionsProfile();
  const showPeriod = visibleAddActions(profile).some((action) => action.key === "menstrualCycle");
  const tiles = TILES.filter((tile) => !("requiresCycleTracking" in tile) || showPeriod);

  const context = new URLSearchParams();
  if (date) context.set("date", date);
  if (time) context.set("time", time);
  const suffix = context.toString();
  const withContext = (href: string) =>
    suffix ? `${href}${href.includes("?") ? "&" : "?"}${suffix}` : href;

  return (
    <div className="hf-page">
      <MealShareBar />
      <AccordionCard>
        <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-5">
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              href={withContext(tile.href)}
              className="flex flex-col items-center gap-0 rounded-[8px] p-2 text-center"
            >
              <Image
                src={tile.icon}
                alt=""
                width={96}
                height={96}
                className="-mb-4 h-24 w-24 object-contain"
                unoptimized={tile.icon.endsWith(".svg")}
              />
              <span className="hf-type-body">{t(`addMenu.${tile.key}`)}</span>
            </Link>
          ))}
        </div>
      </AccordionCard>
    </div>
  );
}

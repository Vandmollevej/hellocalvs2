"use client";

import Image from "next/image";
import Link from "next/link";
import { MealShareBar } from "@/components/family/MealShareBar";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { useAddActionsProfile, visibleAddActions } from "@/lib/add-actions";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Tilføj"-menuen: otte 3D-ikon-felter (2 kolonner på mobil, én række på
// bredere skærme) i det beige kort. Vises af AddMenuSheet (forsidehjulets
// "Se alle" og kalenderens "Tilføj" på en time) og af /add/menu.
// Aktivitet har intet 3D-ikon og ligger som almindelig række under feltet.
// Målvægt og menstruation vises ikke her (menstruation kun i kalenderen).
//
// date/time (kalenderens tilfælde) sendes videre på hver href som ekstra
// query-parametre, så /foods lander registreringen på det valgte klokkeslæt.
const TILES = [
  { key: "food", href: "/search", icon: "food" },
  { key: "scan", href: "/camera?mode=product", icon: "scan" },
  { key: "platePhoto", href: "/camera?mode=meal", icon: "plate-photo" },
  { key: "dish", href: "/create-dish", icon: "dish" },
  { key: "voice", href: "/voice", icon: "voice" },
  { key: "weight", href: "/weight/create", icon: "weight" },
  { key: "drink", href: "/water/create", icon: "drink" },
  { key: "body", href: "/profile/body-measurements", icon: "body" },
] as const;

export function AddMenuList({ date, time }: { date?: string | null; time?: string | null }) {
  const { t } = useTranslation();
  const profile = useAddActionsProfile();
  const extraActions = visibleAddActions(profile).filter((action) => action.key === "activity");

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
        <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-8">
          {TILES.map((tile) => (
            <Link
              key={tile.key}
              href={withContext(tile.href)}
              className="flex flex-col items-center gap-1 rounded-[8px] p-2 text-center"
            >
              <Image
                src={`/icons/add/${tile.icon}.webp`}
                alt=""
                width={96}
                height={96}
                className="h-24 w-24 object-contain"
              />
              <span className="hf-type-body">{t(`addMenu.${tile.key}`)}</span>
            </Link>
          ))}
        </div>
        {extraActions.map((action) => (
          <div key={action.key} className="border-t border-hf-tan-dark">
            <ChevronRow
              icon={action.icon ? <action.icon size={20} /> : null}
              label={t(action.labelKey)}
              href={withContext(action.href)}
              divider={false}
            />
          </div>
        ))}
      </AccordionCard>
    </div>
  );
}

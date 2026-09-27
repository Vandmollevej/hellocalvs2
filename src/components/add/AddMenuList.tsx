"use client";

import Image from "next/image";
import { MealShareBar } from "@/components/family/MealShareBar";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { useAddActionsProfile, visibleAddActions } from "@/lib/add-actions";
import { useTranslation } from "@/i18n/LocaleProvider";

// Every real add-element in the app in one list, regardless of which subset
// the user picked for the front-page wheel (settings → Visning → Forside).
// Shown by AddMenuSheet (the wheel's fixed "Se alle" slot and the calendar's
// hour "Tilføj" bar) and by the /add/menu route.
//
// date/time (the calendar's case) are forwarded onto every action's href as
// extra query params — harmless for actions that ignore them, and what lets
// /foods land the registration at the tapped hour.
export function AddMenuList({ date, time }: { date?: string | null; time?: string | null }) {
  const { t } = useTranslation();
  const profile = useAddActionsProfile();
  const actions = visibleAddActions(profile);

  const context = new URLSearchParams();
  if (date) context.set("date", date);
  if (time) context.set("time", time);
  const suffix = context.toString();

  return (
    <div className="hf-page">
      <MealShareBar />
      <AccordionCard>
        {actions.map((action, index) => (
          <ChevronRow
            key={action.key}
            icon={
              action.icon ? (
                <action.icon size={20} />
              ) : (
                <Image src={action.imageSrc!} alt="" width={20} height={20} className="object-contain" />
              )
            }
            label={t(action.labelKey)}
            href={suffix ? `${action.href}${action.href.includes("?") ? "&" : "?"}${suffix}` : action.href}
            divider={index < actions.length - 1}
          />
        ))}
      </AccordionCard>
    </div>
  );
}

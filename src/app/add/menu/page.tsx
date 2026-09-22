"use client";

import Image from "next/image";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { useAddActionsProfile, visibleAddActions } from "@/lib/add-actions";
import { useTranslation } from "@/i18n/LocaleProvider";

// Opened from the fixed "list" slot at the top of the front page's joystick
// wheel (AddButton.tsx), and — since 2026-09-19 — from the calendar's own
// hour "Tilføj" bar too (src/app/calendar/page.tsx), per the user's explicit
// request that both entry points show the same menu. Every real add-element
// in the app in one screen, regardless of which subset the user picked for
// the wheel itself (settings → Visning → Forside). A quick shortcut to
// weight, goal/measurements and everything else.
//
// When opened with ?date=&time= (the calendar's case), those are forwarded
// onto every action's href as extra query params — harmless for actions that
// ignore them, and what lets /foods land the registration at the tapped hour.
function AddMenuContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const profile = useAddActionsProfile();
  const actions = visibleAddActions(profile);

  const context = new URLSearchParams();
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  if (date) context.set("date", date);
  if (time) context.set("time", time);
  const suffix = context.toString();

  return (
    <HfScreen title={t("addMenu.title")}>
      <div className="flex flex-col gap-4 p-4">
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
    </HfScreen>
  );
}

export default function AddMenuPage() {
  return (
    <Suspense fallback={null}>
      <AddMenuContent />
    </Suspense>
  );
}

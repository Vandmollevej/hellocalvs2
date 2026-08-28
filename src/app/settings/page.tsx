"use client";

import {
  IconHelp,
  IconFileText,
  IconWorld,
  IconRefresh,
  IconPlugConnected,
} from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { BottomNav } from "@/components/BottomNav";

function restartOnboarding() {
  fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      onboardingStep: 0,
      onboardingCompletedAt: null,
      onboardingRemindLaterAt: null,
      onboardingDismissed: false,
    }),
  })
    .then(() => {
      window.location.href = "/";
    })
    .catch(() => {});
}

export default function SettingsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Indstillinger" />

      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-tan p-5 text-center">
          <p className="text-[15px] font-bold text-hf-black">
            Vælg dine egne opskrifter, og skræddersy din måltidskasse.
          </p>
          <button className="hf-btn-primary mt-4 w-full py-3 text-[15px]">
            Log ind / tilmeld
          </button>
        </div>

        <AccordionCard>
          <ChevronRow icon={<IconHelp size={20} />} label="Hjælpecenter" />
          <ChevronRow
            icon={<IconRefresh size={20} />}
            label="Genstart opsætningsguide"
            onClick={restartOnboarding}
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconPlugConnected size={20} />}
            label="Integrationer"
            href="/settings/integrationer"
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow icon={<IconFileText size={20} />} label="Betingelser" />
          <ChevronRow icon={<IconFileText size={20} />} label="Privatlivspolitik" />
          <ChevronRow icon={<IconFileText size={20} />} label="Datasporing" divider={false} />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow icon={<IconWorld size={20} />} label="Vælg dit land" divider={false} />
        </AccordionCard>
      </div>

      <div className="flex-1" />
      <BottomNav />
    </div>
  );
}

import {
  IconHelp,
  IconFileText,
  IconWorld,
} from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { BottomNav } from "@/components/BottomNav";

export default function SettingsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Indstillinger" />

      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-tan p-5 text-center">
          <p className="text-[15px] font-bold text-hf-black">
            Vælg dine egne opskrifter, og skræddersy din måltidskasse.
          </p>
          <button className="mt-4 w-full rounded-full bg-hf-black py-3 text-[15px] font-bold text-hf-white">
            Log ind / tilmeld
          </button>
        </div>

        <AccordionCard>
          <ChevronRow icon={<IconHelp size={20} />} label="Hjælpecenter" divider={false} />
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

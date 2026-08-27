import { TopBar } from "@/components/TopBar";
import { Hero } from "@/components/Hero";
import { DailyList } from "@/components/DailyList";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <OnboardingWizard />
      <TopBar />

      <div className="mt-1.5">
        <Hero />
      </div>

      <div className="mx-4 h-px bg-hf-tan-dark" />

      <div className="min-h-0 flex-1 overflow-hidden pt-1.5">
        <DailyList />
      </div>

      <BottomNav />
    </div>
  );
}

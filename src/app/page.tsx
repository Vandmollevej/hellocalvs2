import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { Hero } from "@/components/Hero";
import { DailyList } from "@/components/DailyList";
import { BottomNav } from "@/components/BottomNav";
import { LandingPage } from "@/components/landing/LandingPage";
import { getSessionUser } from "@/lib/session";
import { HeartRateSpikePrompt } from "@/components/activity/HeartRateSpikePrompt";

// Forsiden må ikke indekseres af søgemaskiner.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Home() {
  // Ikke-indloggede besøgende ser den offentlige "hent appen"-side.
  const user = await getSessionUser();
  if (!user) return <LandingPage />;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <TopBar />

      <div className="mt-8">
        <Hero />
      </div>

      {/* Ligger over tal-hjulet (z-10 + baggrund), så hjulets rækker drejer
          ind bag listen i stedet for ned over skillestregen (bruger
          2026-09-29). Tilføj-knappens vifte (z-30) ligger stadig øverst. */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden bg-hf-cream pt-2">
        <DailyList />
      </div>

      <BottomNav />

      <HeartRateSpikePrompt />
    </div>
  );
}

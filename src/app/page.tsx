import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { Hero } from "@/components/Hero";
import { HomeWaves } from "@/components/HomeWaves";
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
      {/* Bølge-baggrunden (bruger 2026-10-01) ligger bag topbar og hero og
          stopper ved "Dagens tilføjelser"-stregen (bruger 2026-10-03). Alt
          andet her er `relative`, så det males oven på bølgerne. */}
      <div className="relative flex-none">
        <HomeWaves />
        <div className="relative">
          <TopBar />
        </div>
        <div className="relative mt-8">
          <Hero />
        </div>
      </div>

      {/* Ligger over hero (z-10). Listen har ikke længere en dækkende
          baggrund, så bølgerne kan skinne igennem; tal-hjulets rækker klippes
          i stedet ved hero-bunden (StatsWheel), så de stadig drejer ind bag
          listen og ikke ned over skillestregen (bruger 2026-09-29).
          Tilføj-knappens vifte (z-30) ligger stadig øverst. */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden pt-2">
        <DailyList />
      </div>

      <BottomNav />

      <HeartRateSpikePrompt />
    </div>
  );
}

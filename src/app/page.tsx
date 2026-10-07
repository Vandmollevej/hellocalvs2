import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { Hero } from "@/components/Hero";
import { HomeWaves } from "@/components/HomeWaves";
import { DailyList } from "@/components/DailyList";
import { BottomNav } from "@/components/BottomNav";
import { FooterArc } from "@/components/FooterArc";
import { LandingPage } from "@/components/landing/LandingPage";
import { getSessionUser } from "@/lib/session";
import { HeartRateSpikePrompt } from "@/components/activity/HeartRateSpikePrompt";
import { WeighInPrompts } from "@/components/weight/WeighInPrompts";

// Forsiden må ikke indekseres af søgemaskiner.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Home() {
  // Ikke-indloggede besøgende ser den offentlige "hent appen"-side.
  const user = await getSessionUser();
  if (!user) return <LandingPage />;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      {/* Bølge-baggrunden er fjernet (bruger 2026-10-05); kun puls-linjen
          bag topbar og hero er tilbage. */}
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

      {/* Lille halvcirkel midt over footeren (bruger 2026-10-07, prøve). */}

      <FooterArc />

      <BottomNav />

      <HeartRateSpikePrompt />
      <WeighInPrompts />
    </div>
  );
}

import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { Hero } from "@/components/Hero";
import { DailyList } from "@/components/DailyList";
import { BottomNav } from "@/components/BottomNav";
import { LandingPage } from "@/components/landing/LandingPage";
import { getSessionUser } from "@/lib/session";

// Forsiden må ikke indekseres af søgemaskiner.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Home() {
  // Ikke-indloggede besøgende ser den offentlige "hent appen"-side.
  const user = await getSessionUser();
  if (!user) return <LandingPage />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-hf-cream">
      <TopBar />

      <div className="mt-8 shrink-0">
        <Hero />
      </div>

      <div className="mx-4 h-px shrink-0 bg-hf-tan-dark" />

      <div className="min-h-0 flex-1 overflow-hidden pt-2">
        <DailyList />
      </div>

      <BottomNav />
    </div>
  );
}

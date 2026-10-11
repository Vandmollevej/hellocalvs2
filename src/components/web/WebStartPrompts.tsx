"use client";

import { usePathname } from "next/navigation";
import { HeartRateSpikePrompt } from "@/components/activity/HeartRateSpikePrompt";
import { WeighInPrompts } from "@/components/weight/WeighInPrompts";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";

// Forsidens popups sidder kun på appens forside (`src/app/page.tsx`):
// vægt/tøj ("Du har vejet dig i morges …"), "Det er længe siden, der er
// synkroniseret" og pulsudsving ("Hvad foretog du dig?"). Desktop-skallen
// sender roden videre til kalenderens dagsvisning, så uden denne komponent
// ville webversionen aldrig vise dem. De åbnes derfor på kalenderen, som er
// webversionens forside (bruger 2026-10-11: webben skal kunne alt, hvad appen
// kan). Monteres af `AppFrame` via WebShells `overlays`, så arkene ligger
// inde i indholdsfladen som appens øvrige bundark.
export function WebStartPrompts() {
  const pathname = usePathname() ?? "/";
  const { status } = useFamilyStatus();
  // status findes kun for indloggede (ikke på login/offentlige sider).
  if (!status || pathname !== "/calendar") return null;
  return (
    <>
      <HeartRateSpikePrompt />
      <WeighInPrompts />
    </>
  );
}

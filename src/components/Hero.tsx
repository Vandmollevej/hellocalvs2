"use client";

import { useEffect, useState } from "react";
import { AddButton, HERO_HEIGHT } from "./AddButton";
import { StatsWheel } from "./StatsWheel";
import { OnboardingSpotlight } from "./OnboardingSpotlight";

// Denne overlay har hidtil altid vist sig igen ved hvert genbesøg — den var
// hardkodet til IS_NEW_USER = true og aldrig forbundet til rigtig gemt
// tilstand ("Assumption for the prototype", stod der). Fundet 2026-09-07
// efter direkte brugerrapport ("guide/test-skærmen er stadig ikke
// deaktiveret"). Gemmes nu client-side, samme mønster som BottomNav/
// StatChart's localStorage-persistens, i stedet for at kræve en ny
// databasekolonne til noget der reelt kun er et engangs-FAB-hint.
const STORAGE_KEY = "hellocal:onboarding-spotlight-dismissed:v1";

function loadDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Hero() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Samme "hydrer fra localStorage efter mount"-mønster som BottomNav —
    // undgår en hydration-mismatch, da serveren ikke kender den gemte værdi.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setShowOnboarding(!loadDismissed());
  }, []);

  function dismiss() {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Utilgængeligt lager (privat browsing e.l.) — ignorér, vises da igen næste gang.
    }
  }

  return (
    <div className="relative" style={{ height: HERO_HEIGHT }}>
      <AddButton onOpen={dismiss} />
      <StatsWheel side="right" />
      {showOnboarding && <OnboardingSpotlight side="left" onLater={dismiss} />}
    </div>
  );
}

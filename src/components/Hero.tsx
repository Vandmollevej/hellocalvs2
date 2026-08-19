"use client";

import { useState } from "react";
import { AddButton, HERO_HEIGHT } from "./AddButton";
import { StatsWheel } from "./StatsWheel";
import { OnboardingSpotlight } from "./OnboardingSpotlight";

// Antagelse for prototypen: brugeren er ny og har ikke set onboarding før.
// I appen skal dette komme fra brugerens faktiske onboarding-status.
const IS_NEW_USER = true;

export function Hero() {
  const [showOnboarding, setShowOnboarding] = useState(IS_NEW_USER);

  return (
    <div className="relative" style={{ height: HERO_HEIGHT }}>
      <AddButton onOpen={() => setShowOnboarding(false)} />
      <StatsWheel />
      {showOnboarding && (
        <OnboardingSpotlight onLater={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

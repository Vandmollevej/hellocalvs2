"use client";

import { useState } from "react";
import { AddButton, HERO_HEIGHT } from "./AddButton";
import { StatsWheel } from "./StatsWheel";
import { OnboardingSpotlight } from "./OnboardingSpotlight";

// Assumption for the prototype: the user is new and hasn't seen onboarding before.
// In the app this should come from the user's actual onboarding status.
const IS_NEW_USER = true;

export function Hero() {
  const [showOnboarding, setShowOnboarding] = useState(IS_NEW_USER);

  return (
    <div className="relative" style={{ height: HERO_HEIGHT }}>
      <AddButton onOpen={() => setShowOnboarding(false)} />
      <StatsWheel side="right" />
      {showOnboarding && (
        <OnboardingSpotlight side="left" onLater={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

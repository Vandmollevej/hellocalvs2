"use client";

import { useState } from "react";
import { AddButton, HERO_HEIGHT, useFabPosition } from "./AddButton";
import { StatsWheel } from "./StatsWheel";
import { OnboardingSpotlight } from "./OnboardingSpotlight";

// Antagelse for prototypen: brugeren er ny og har ikke set onboarding før.
// I appen skal dette komme fra brugerens faktiske onboarding-status.
const IS_NEW_USER = true;

export function Hero() {
  const [showOnboarding, setShowOnboarding] = useState(IS_NEW_USER);
  const [fabPosition, setFabPosition] = useFabPosition();

  const wheelSide = fabPosition.side === "left" ? "right" : "left";

  return (
    <div className="relative" style={{ height: HERO_HEIGHT }}>
      <AddButton
        position={fabPosition}
        onPositionChange={setFabPosition}
        onOpen={() => setShowOnboarding(false)}
      />
      <StatsWheel side={wheelSide} />
      {showOnboarding && (
        <OnboardingSpotlight side={fabPosition.side} onLater={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

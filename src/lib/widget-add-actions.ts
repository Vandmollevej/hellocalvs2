// Server-safe twin of visibleAddActions() in src/lib/add-actions.ts (which
// can't be imported from route handlers because it also exports React hooks).
// Keep the gating rule identical: menstrualCycle only for FEMALE users with
// cycle tracking switched on (docs/DECISIONS.md 2026-09-19).

import type { AddActionKey } from "@/lib/add-actions";
import { WIDGET_ADD_ACTIONS } from "@/lib/widgets";

export function visibleAddActions(profile: {
  sex: "FEMALE" | "MALE" | null;
  cycleTrackingEnabled: boolean;
}): AddActionKey[] {
  return (Object.keys(WIDGET_ADD_ACTIONS) as AddActionKey[]).filter(
    (key) => key !== "menstrualCycle" || (profile.sex === "FEMALE" && profile.cycleTrackingEnabled),
  );
}

"use client";

import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";

// 1 px blå ramme rundt om hele skærmen, så længe en anden person er på den
// viste profil (docs/FAMILY.md). Ligger over alt og fanger ingen tryk.
export function FamilyWatchFrame() {
  const { status } = useFamilyStatus();
  if (!status || status.presence.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] border border-hf-watch"
    />
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Låse-informationen er flyttet til en popup på Profil (docs/DECISIONS.md
// 2026-10-11); den gamle rute sender videre dertil.
export default function StartWeightLockPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile/edit");
  }, [router]);
  return null;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Tale-siden er flettet ind i Madvarer (2026-10-16): mikrofonen ligger nu over
// søgefeltet på /foods. Gamle links og widgets til /voice sendes derhen og
// starter mikrofonen.
export default function VoicePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/foods?mic=1");
  }, [router]);
  return null;
}

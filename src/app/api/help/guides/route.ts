import { NextResponse } from "next/server";
import { HELP_GUIDES } from "@/lib/help-guides";

// Hjælpecenteret (statisk HTML i public/) henter her "Guide mig"-knapperne, så
// de altid følger registret i src/lib/help-guides.ts uden at siderne skal
// genereres igen (DECISIONS 2026-10-09). Åbent: kun emne-id'er og knaptekster.
const LABELS = {
  da: { guideMe: "Guide mig", shortcut: "Gå direkte til siden" },
  en: { guideMe: "Guide me", shortcut: "Go straight to the page" },
  de: { guideMe: "Führ mich", shortcut: "Direkt zur Seite" },
  fr: { guideMe: "Guidez-moi", shortcut: "Aller directement à la page" },
  nl: { guideMe: "Wijs me de weg", shortcut: "Direct naar de pagina" },
  sv: { guideMe: "Guida mig", shortcut: "Gå direkt till sidan" },
  no: { guideMe: "Veiled meg", shortcut: "Gå rett til siden" },
};

export function GET() {
  const guides = HELP_GUIDES.flatMap((guide) =>
    (guide.topics ?? []).map((topic) => ({
      id: topic,
      shortcut: guide.href,
      // Overlayet starter fra forsiden (plus-knappen og bundmenuen sidder dér).
      start: `/?guide=${encodeURIComponent(guide.id)}`,
    })),
  );
  return NextResponse.json(
    { labels: LABELS, guides },
    { headers: { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex, nofollow" } },
  );
}

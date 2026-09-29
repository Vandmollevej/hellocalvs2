import { redirect } from "next/navigation";

// Analyse er slået sammen med Statistik (docs/DECISIONS.md 2026-09-29).
export default function AnalyticsPage() {
  redirect("/admin/statistics?view=traffic");
}

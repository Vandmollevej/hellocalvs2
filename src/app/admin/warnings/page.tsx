import { redirect } from "next/navigation";

// "Advarsler" er erstattet af "Uncertainties" (docs/DECISIONS.md 2026-09-24).
// Gamle links/bogmærker sendes videre.
export default function AdminWarningsPage() {
  redirect("/admin/uncertainties");
}

import { redirect } from "next/navigation";

// Den tidligere "Mål"-side er afløst af Målsætning (oversigt + opret-formular,
// docs/DECISIONS.md 2026-09-22). Gamle links/bogmærker sendes videre.
export default function TargetWeightPage() {
  redirect("/profile/goals");
}

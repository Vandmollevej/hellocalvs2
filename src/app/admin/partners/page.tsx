import { redirect } from "next/navigation";

// "Partnere" er en menugruppe med Reklamer og Kontakter (docs/DECISIONS.md
// 2026-09-29); selve gruppen har ingen egen side.
export default function PartnersPage() {
  redirect("/admin/partners/contacts");
}

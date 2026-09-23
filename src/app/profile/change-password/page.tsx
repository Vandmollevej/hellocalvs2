import { redirect } from "next/navigation";

// Hello Cal har ikke længere adgangskoder (docs/PRIVACY.md). Gamle links
// hertil sendes videre til Login og gendannelse.
export default function ChangePasswordPage() {
  redirect("/profile/security");
}

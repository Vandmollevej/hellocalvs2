import { getSessionUser } from "@/lib/session";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

// Skift adgangskode kræver en rigtig brugersession (ikke den delte
// demo-bruger) — samme server-side tjek som /forward/[token]. API'et
// håndhæver det uafhængigt af denne side.
export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  return <ChangePasswordForm loggedIn={Boolean(user)} />;
}

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSession } from "@/lib/user-auth";
import { getDemoUser } from "@/lib/demo-user";

// Bruges af de NYE ruter i pointsystem-batchen (points, fejlrapporter,
// videresend, notifikationspræferencer m.fl.) — se src/lib/user-auth.ts for
// baggrunden om hvorfor dette er adskilt fra den eksisterende getDemoUser().
export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(USER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifyUserSession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.forgottenAt) return null;
  return user;
}

// Foretrækker en rigtig session, falder tilbage til den delte demo-bruger.
// Bruges KUN i src/app/api/registrations/route.ts, fordi "videresend til en
// ven" kræver at to logget-ind brugere reelt har hver deres egen dag at
// tilføje til — uden dette ville en modtagers "tilføj til i dag" lande på
// den samme delte demo-bruger som alle andre ikke-loggede-ind besøgende.
// Bevarer eksisterende adfærd for anonym/demo-brug (ingen session = som før).
export async function getEffectiveUser() {
  return (await getSessionUser()) ?? (await getDemoUser());
}

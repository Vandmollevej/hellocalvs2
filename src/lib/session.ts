import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSession } from "@/lib/user-auth";

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

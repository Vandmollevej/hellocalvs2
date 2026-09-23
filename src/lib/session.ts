import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSession } from "@/lib/user-auth";

// Den indloggede bruger (passkey-session, docs/PRIVACY.md). Der findes ikke
// længere en delt demo-bruger: private data ligger i brugerens krypterede
// boks, og serverruter kræver en rigtig session.
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


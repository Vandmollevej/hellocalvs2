import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSession } from "@/lib/user-auth";

// Den indloggede bruger ud fra session-cookien (src/lib/user-auth.ts), eller
// null. Alle private endpoints bruger denne og svarer 401 uden session.
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

export function unauthorized() {
  return NextResponse.json({ message: "Log ind for at fortsætte" }, { status: 401 });
}

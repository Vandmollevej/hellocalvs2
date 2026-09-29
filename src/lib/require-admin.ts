import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionInfo } from "@/lib/admin-auth";
import { clientIpFromHeaders, isIpAllowedByList } from "@/lib/admin-access";

// Server-side belt-and-suspenders check in addition to middleware.ts —
// every admin page/route calls this so protection does not depend solely on
// the middleware matcher staying correct.
//
// Admin-brugere (docs/DECISIONS.md 2026-09-29): deaktiverede brugere, sessioner
// udstedt før en niveau-/IP-ændring og forbindelser uden for brugerens
// IP-liste afvises her — også midt i en igangværende session.
export async function requireAdminUser() {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifyAdminSessionInfo(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "ADMIN") return null;
  if (user.adminDisabledAt) return null;
  if (user.adminSessionsValidFrom && session.issuedAt < user.adminSessionsValidFrom.getTime()) return null;
  if (user.adminAllowedIps && !isIpAllowedByList(user.adminAllowedIps, clientIpFromHeaders(await headers()))) return null;
  return user;
}

// Kun fuld administratoradgang (ikke læseadgang) — til alt, der ændrer data.
export async function requireFullAdminUser() {
  const user = await requireAdminUser();
  if (!user || user.adminAccessLevel !== "FULL") return null;
  return user;
}

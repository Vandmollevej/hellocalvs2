import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";

// Server-side belt-and-suspenders check in addition to middleware.ts —
// every admin page/route calls this so protection does not depend solely on
// the middleware matcher staying correct.
export async function requireAdminUser() {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await verifyAdminSession(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

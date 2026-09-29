import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_APPROVAL_COOKIE, ADMIN_SESSION_COOKIE, signAdminSession, verifyAdminApprovalPending } from "@/lib/admin-auth";
import { checkAdminLoginAllowed, logAdminLogin, registerDevice, requestInfo, sessionCookieOptions } from "@/lib/admin-access";

// Login-siden spørger her, om ny-enheds-linket i mailen er godkendt. Kun den
// browser, der startede login (approval-cookien), kan hente sessionen — et
// videresendt mail-link giver derfor aldrig adgang på en anden enhed.
export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(ADMIN_APPROVAL_COOKIE)?.value;
  const approvalId = token ? await verifyAdminApprovalPending(token) : null;
  if (!approvalId) return NextResponse.json({ status: "expired" }, { status: 401 });

  const approval = await prisma.adminLoginApproval.findUnique({ where: { id: approvalId }, include: { user: true } });
  if (!approval || approval.consumedAt || approval.expiresAt < new Date()) {
    return NextResponse.json({ status: "expired" }, { status: 401 });
  }
  if (!approval.approvedAt) return NextResponse.json({ status: "pending" });

  const info = requestInfo(req.headers);
  const user = approval.user;
  if (user.role !== "ADMIN" || !(await checkAdminLoginAllowed(user, info, "device-approval"))) {
    return NextResponse.json({ status: "blocked" }, { status: 403 });
  }

  await prisma.adminLoginApproval.update({ where: { id: approval.id }, data: { consumedAt: new Date() } });
  await registerDevice(user.id, approval.deviceId, info);
  await logAdminLogin(user.id, "APPROVED", "device-approval", info);
  await logAdminLogin(user.id, "SUCCESS", "device-approval", info);

  const response = NextResponse.json({ status: "approved" });
  response.cookies.set(ADMIN_SESSION_COOKIE, await signAdminSession(user.id, user.adminAccessLevel), sessionCookieOptions());
  response.cookies.delete(ADMIN_APPROVAL_COOKIE);
  return response;
}

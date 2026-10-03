import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollLoginApproval } from "@/lib/login-approval";
import { completeLogin } from "@/lib/user-login";

// Den ventende browser spørger her, om login er godkendt. Godkendt → sessionen
// sættes (kun én gang pr. godkendelse).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const id = typeof body.approvalId === "string" ? body.approvalId : "";
  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!id || !secret) return NextResponse.json({ status: "expired" });

  const result = await pollLoginApproval(id, secret);
  if (result.status !== "approved" || !result.userId) return NextResponse.json({ status: result.status });

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, email: true, displayName: true, forgottenAt: true },
  });
  if (!user || user.forgottenAt) return NextResponse.json({ status: "expired" });

  const response = NextResponse.json({
    status: "approved",
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
  return completeLogin(req, response, user.id, "password");
}

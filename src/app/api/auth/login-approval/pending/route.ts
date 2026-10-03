import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { listPendingApprovals, respondToApproval } from "@/lib/login-approval";

// Den allerede indloggede enhed ser de ventende logins og svarer på dem.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ approvals: await listPendingApprovals(user.id) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const id = typeof body.approvalId === "string" ? body.approvalId : "";
  if (!id || typeof body.approve !== "boolean") {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const ok = await respondToApproval(user.id, id, body.approve);
  if (!ok) return NextResponse.json({ message: "Anmodningen er udløbet eller allerede besvaret" }, { status: 409 });
  return NextResponse.json({ success: true });
}

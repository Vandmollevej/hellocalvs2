import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { findActiveFlowForUser, recordSectionVisit } from "@/lib/flows";

// Guide-flows (docs/DECISIONS.md 2026-10-06): FlowGate spørger ved hvert
// sideskift. Besøget registreres først, så "har besøgt"-betingelser passer.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const path = new URL(request.url).searchParams.get("path") || "/";
  if (!path.startsWith("/") || path.length > 300) {
    return NextResponse.json({ message: "Ugyldig sti" }, { status: 400 });
  }
  try {
    await recordSectionVisit(user.id, path);
    const flow = await findActiveFlowForUser(user.id, path);
    return NextResponse.json({ flow });
  } catch (error) {
    console.error("Active flow lookup failed", error);
    return NextResponse.json({ flow: null });
  }
}

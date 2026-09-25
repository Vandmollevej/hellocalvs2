import { NextResponse } from "next/server";
import { listIntegrationStatuses } from "@/lib/integrations";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    const integrations = await listIntegrationStatuses(user.id);
    return NextResponse.json({ integrations });
  } catch (error) {
    console.error("Integration list failed", error);
    return NextResponse.json(
      { integrations: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

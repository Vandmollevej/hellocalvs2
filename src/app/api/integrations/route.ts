import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listIntegrationStatuses } from "@/lib/integrations";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
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

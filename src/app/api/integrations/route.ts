import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/demo-user";
import { listIntegrationStatuses } from "@/lib/integrations";

export async function GET() {
  try {
    const user = await getDemoUser();
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

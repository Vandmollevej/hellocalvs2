import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { getApiUsageOverview } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

// Admin → API-forbrug: status, forbrug og budget for alle betalte tjenester.
export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  return NextResponse.json(await getApiUsageOverview(new Date(), force));
}

import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { findLiveHeartRate } from "@/lib/live-heart-rate";

// GET /api/health-metrics/heart-rate — urets aktuelle puls til forsidens
// puls-linje, eller { heartRate: null } uden tilsluttet ur/frisk måling.
export async function GET() {
  const user = await getProfileUser("healthMetrics", "VIEWED");
  if (!user) return unauthorized();
  try {
    return NextResponse.json({ heartRate: await findLiveHeartRate(user.id) });
  } catch (error) {
    console.error("Live heart rate lookup failed", error);
    return NextResponse.json({ heartRate: null });
  }
}

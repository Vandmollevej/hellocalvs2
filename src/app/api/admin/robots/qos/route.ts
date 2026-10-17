import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { loadRobotQos, saveRobotQos } from "@/lib/robot-qos-config";
import { measureServerLoad } from "@/lib/robot-qos-load";

// Robot-QoS på admin → Robotter (docs/DECISIONS.md 2026-10-17).
// GET: indstilling + serverens belastning lige nu. PATCH: { enabled?, settings? }.
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const [qos, load] = await Promise.all([loadRobotQos(), measureServerLoad(500)]);
  return NextResponse.json({ qos, load });
}

export async function PATCH(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const qos = await saveRobotQos({ enabled: body.enabled, settings: body.settings }, admin.id);
  return NextResponse.json({ qos, load: await measureServerLoad(500) });
}

import { NextResponse } from "next/server";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import { loadAlertSettings, saveAlertSettings, sendTestAlert } from "@/lib/api-alerts";

export const dynamic = "force-dynamic";

// Varsler om API-forbrug: til/fra og modtagere (src/lib/api-alerts.ts).
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadAlertSettings());
}

export async function PUT(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown; emails?: unknown };
  const emails = Array.isArray(body.emails) ? body.emails.map(String) : [];
  return NextResponse.json(await saveAlertSettings({ enabled: body.enabled !== false, emails }));
}

// Testmail til alle modtagere.
export async function POST() {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const settings = await loadAlertSettings();
  if (settings.emails.length === 0) return NextResponse.json({ message: "Tilføj først en modtager." }, { status: 400 });
  const sent = await sendTestAlert(settings.emails);
  if (sent === 0) return NextResponse.json({ message: "Mailen kunne ikke sendes — er SMTP sat op?" }, { status: 502 });
  return NextResponse.json({ sent });
}

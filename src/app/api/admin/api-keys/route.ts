import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { KEY_SERVICES, isEditableKey } from "@/lib/api-keys/catalog";
import { ensureSecretsLoaded, resetSecret, saveSecret } from "@/lib/api-keys/store";
import { allServiceStatuses, serviceStatus } from "@/lib/api-keys/status";

// Admin → API-nøgler (docs/DECISIONS.md 2026-09-25 "API-nøgler i admin").
// GET viser status (aldrig hemmelige værdier), PUT gemmer en ny værdi,
// DELETE går tilbage til værdien fra .env.production.

const MAX_LENGTH = 8000;

function serviceForKey(key: string) {
  const service = KEY_SERVICES.find((s) => s.fields.some((f) => f.key === key));
  return service ? serviceStatus(service) : null;
}

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await ensureSecretsLoaded();
  return NextResponse.json({ services: allServiceStatuses() });
}

export async function PUT(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { key?: unknown; value?: unknown };
  const key = typeof body.key === "string" ? body.key : "";
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!isEditableKey(key)) return NextResponse.json({ message: "Nøglen kan ikke rettes her" }, { status: 400 });
  if (!value) return NextResponse.json({ message: "Værdien er tom" }, { status: 400 });
  if (value.length > MAX_LENGTH) return NextResponse.json({ message: "Værdien er for lang" }, { status: 400 });

  await ensureSecretsLoaded();
  await saveSecret(key, value, admin.id);
  return NextResponse.json({ service: serviceForKey(key) });
}

export async function DELETE(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { key?: unknown };
  const key = typeof body.key === "string" ? body.key : "";
  if (!isEditableKey(key)) return NextResponse.json({ message: "Nøglen kan ikke rettes her" }, { status: 400 });

  await ensureSecretsLoaded();
  await resetSecret(key);
  return NextResponse.json({ service: serviceForKey(key) });
}

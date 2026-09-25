import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { serviceById } from "@/lib/api-keys/catalog";
import { runCheck } from "@/lib/api-keys/checks";
import { ensureSecretsLoaded } from "@/lib/api-keys/store";
import { requiredKeys } from "@/lib/api-keys/status";

// Live-test af én tjenestes nøgler, se src/lib/api-keys/checks.ts.
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { serviceId?: unknown };
  const service = typeof body.serviceId === "string" ? serviceById(body.serviceId) : null;
  if (!service || !service.testable) return NextResponse.json({ message: "Ukendt tjeneste" }, { status: 400 });

  await ensureSecretsLoaded();
  const result = await runCheck(service.id, requiredKeys(service), service.redirectUris?.() ?? []);
  return NextResponse.json(result);
}

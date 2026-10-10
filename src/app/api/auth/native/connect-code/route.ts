import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createNativeCode, isNativeClient } from "@/lib/native-auth";

// POST /api/auth/native/connect-code — den indloggede native app henter en
// kortlivet engangskode, før den åbner /api/integrations/<slug>/connect?native=<kode>
// i system-browseren (som ikke har appens session-cookie).
// docs/DECISIONS.md 2026-10-08 "Native login-overdragelse".
export async function POST(req: Request) {
  if (!isNativeClient(req)) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const code = await createNativeCode(user.id, "CONNECT");
  return NextResponse.json({ code, expiresInSeconds: 120 });
}

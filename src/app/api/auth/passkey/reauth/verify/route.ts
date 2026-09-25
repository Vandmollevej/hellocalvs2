import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { USER_WEBAUTHN_AUTH_COOKIE } from "@/lib/user-auth";
import { verifyPasskeyAssertion } from "@/lib/user-passkey";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  const result = await verifyPasskeyAssertion(req, body?.response);
  if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status });
  if (result.userId !== user.id) return NextResponse.json({ message: "Forkert konto" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(USER_WEBAUTHN_AUTH_COOKIE);
  return response;
}

import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { USER_WEBAUTHN_AUTH_COOKIE } from "@/lib/user-auth";
import { verifyPasskeyAssertion } from "@/lib/user-passkey";
import { completeLogin } from "@/lib/user-login";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  const result = await verifyPasskeyAssertion(req, body?.response);
  if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(USER_WEBAUTHN_AUTH_COOKIE);
  return completeLogin(req, response, result.userId, "passkey");
}

import { NextResponse } from "next/server";
import { completeLogin } from "@/lib/user-login";
import { consumeNativeCode, isNativeClient } from "@/lib/native-auth";

// POST /api/auth/native/exchange { code, verifier } — den native app veksler
// engangskoden fra hellocal://auth/complete?code=… til den almindelige
// session-cookie (docs/DECISIONS.md 2026-10-08 "Native login-overdragelse").
export async function POST(req: Request) {
  // Kun appen: en fremmed side kan ikke sætte headeren uden CORS (login-CSRF).
  if (!isNativeClient(req)) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const consumed = await consumeNativeCode(body.code, "LOGIN", body.verifier);
  if (!consumed) {
    return NextResponse.json({ message: "Login-linket er udløbet. Prøv igen." }, { status: 400 });
  }
  // completeLogin afviser selv spærrede konti (403 ACCOUNT_BLOCKED).
  return completeLogin(req, NextResponse.json({ ok: true }), consumed.userId, consumed.method ?? "google");
}

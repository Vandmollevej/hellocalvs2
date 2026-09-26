import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { claimFamilyProfile } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";
import { completeLogin } from "@/lib/user-login";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Et familiemedlem uden login (fx et barn) sætter e-mail og adgangskode på
// den profil, betaleren har oprettet, og bliver logget ind.
export async function POST(req: Request) {
  const body = await readJson(req);
  const code = typeof body.code === "string" ? body.code : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ code: "invalidEmail" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ code: "passwordTooShort" }, { status: 400 });

  const rateLimitKey = `family-claim:${req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown"}`;
  if (isLocked(rateLimitKey)) return NextResponse.json({ code: "tooManyAttempts" }, { status: 429 });

  try {
    const user = await claimFamilyProfile(code, email, await bcrypt.hash(password, 12));
    recordSuccess(rateLimitKey);
    return completeLogin(req, NextResponse.json({ ok: true }), user.id, "password");
  } catch (error) {
    recordFailure(rateLimitKey);
    return familyErrorResponse(error);
  }
}

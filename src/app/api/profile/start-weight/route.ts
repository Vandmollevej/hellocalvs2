import { NextResponse } from "next/server";
import {
  changeStartWeightWithToken,
  inspectStartWeightChangeToken,
  isValidStartWeight,
  parseWeightInput,
} from "@/lib/start-weight-verification";

// Offentlig ende af start-vægt-verificeringen (docs/DECISIONS.md 2026-09-22):
// selve engangstokenet fra mailen er autorisationen, ligesom ved
// /api/auth/reset-password. Fejlsvar er bevidst generiske.
const INVALID_LINK = "Verificeringslinket er ugyldigt, udløbet eller allerede brugt.";

// GET ?token=… — kontrollerer linket uden at forbruge det.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const result = await inspectStartWeightChangeToken(token);
    if (!result) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }
    return NextResponse.json({ valid: true, currentWeightKg: result.currentWeightKg });
  } catch {
    console.error("Start-weight token validation failed");
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

// POST { token, weightKg } — gemmer ny start-vægt og forbruger tokenet atomisk.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const weightKg = parseWeightInput(body.weightKg);
  if (!token) {
    return NextResponse.json({ message: INVALID_LINK, code: "invalid_token" }, { status: 400 });
  }
  if (!isValidStartWeight(weightKg)) {
    return NextResponse.json({ message: "Angiv en gyldig startvægt.", code: "invalid_weight" }, { status: 400 });
  }

  try {
    const result = await changeStartWeightWithToken(token, weightKg);
    if (!result) {
      return NextResponse.json({ message: INVALID_LINK, code: "invalid_token" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      weightKg: result.weightKg,
      startWeightUpdatedAt: result.startWeightUpdatedAt,
    });
  } catch {
    console.error("Start-weight update failed");
    return NextResponse.json({ message: "Kunne ikke gemme startvægten" }, { status: 500 });
  }
}

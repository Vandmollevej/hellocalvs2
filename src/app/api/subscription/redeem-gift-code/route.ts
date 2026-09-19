import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { redeemGiftCode, RedeemGiftCodeError } from "@/lib/gift-codes";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at indløse en gavekode" }, { status: 401 });

  const body = await req.json();
  const code = typeof body?.code === "string" ? body.code : "";

  try {
    const result = await redeemGiftCode(user.id, code);
    return NextResponse.json({ ok: true, currentPeriodEnd: result.currentPeriodEnd });
  } catch (error) {
    if (error instanceof RedeemGiftCodeError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Gift code redemption failed", error);
    return NextResponse.json({ message: "Kunne ikke indløse gavekoden lige nu" }, { status: 500 });
  }
}

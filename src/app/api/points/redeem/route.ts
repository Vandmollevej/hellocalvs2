import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { redeemFreeMonth, RedeemFreeMonthError } from "@/lib/points";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at indløse points" }, { status: 401 });

  try {
    await redeemFreeMonth(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RedeemFreeMonthError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Free month redemption failed", error);
    return NextResponse.json({ message: "Kunne ikke indløse points lige nu" }, { status: 500 });
  }
}

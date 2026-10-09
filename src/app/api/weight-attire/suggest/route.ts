import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { suggestAttireFor } from "@/lib/weight-attire-server";

// GET — algoritmens gæt på tøj, hvis brugeren vejer sig nu.
export async function GET() {
  try {
    const user = await getProfileUser("weight", "VIEWED");
    if (!user) return unauthorized();
    return NextResponse.json({ suggestion: await suggestAttireFor(user.id, new Date()) });
  } catch (error) {
    console.error("Weight attire suggestion failed", error);
    return NextResponse.json({ suggestion: "CLOTHED_PHONE" });
  }
}

import { NextResponse } from "next/server";
import { getProfileUser } from "@/lib/family-access";
import { unauthorized } from "@/lib/session";
import { estimateActivityKcal, isTrainingIntensity } from "@/lib/activity-met";

// Anslåede netto-kcal for en aktivitet, før den gemmes (docs/ACTIVITY-PAL.md
// F3). Vægten hentes fra profilen; uden vægt er kcal null.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportType = url.searchParams.get("sportType") ?? "other";
  const minutes = Number(url.searchParams.get("minutes"));
  const intensity = url.searchParams.get("intensity");
  const distanceKm = Number(url.searchParams.get("distanceKm"));
  if (!(minutes > 0)) return NextResponse.json({ message: "minutes > 0 er påkrævet" }, { status: 400 });
  try {
    const user = await getProfileUser("activities", "VIEWED");
    if (!user) return unauthorized();
    const estimate = estimateActivityKcal({
      sportType,
      minutes,
      weightKg: user.weightKg,
      intensity: isTrainingIntensity(intensity) ? intensity : null,
      distanceKm: distanceKm > 0 ? distanceKm : null,
    });
    return NextResponse.json({ estimate, hasWeight: user.weightKg !== null });
  } catch (error) {
    console.error("Activity estimate failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isDoctorShareHistoryRange } from "@/lib/doctor-share";
import { fetchDoctorShareOwnerData } from "@/lib/doctor-share-data";

// Data behind /settings/hello-doc/preview ("Sådan ser det ud"). This is a
// PREVIEW of the owner's own data in the Hello Doc layout, always showing
// every category (the owner is looking at their own data) — the real
// token-authenticated external view, which redacts by the recipient's
// granted categories, lives at /api/hello-doc/[token] instead.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se forhåndsvisningen" }, { status: 401 });

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range = isDoctorShareHistoryRange(rangeParam) ? rangeParam : "ALL";

  const data = await fetchDoctorShareOwnerData(user.id, range);
  return NextResponse.json({ ...data, range });
}

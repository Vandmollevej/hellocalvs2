import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { hashDeviceToken } from "@/lib/device-tokens";
import { buildWidgetSnapshot } from "@/lib/widget-data";
import { DEFAULT_LOCALE, isLocale } from "@/i18n";

// GET — all data behind the home-screen widgets (docs/WIDGETS.md). The native
// apps call it with their personal device token (same token as the HealthKit
// companion, docs/HEALTHKIT_COMPANION.md); the in-app preview at /widgets
// uses the normal login cookie.
//
// Query: tzOffsetMinutes (minutes east of UTC, e.g. 120 for Danish summer
// time) so "today" and the 7-day charts follow the phone's clock; locale=da|en.
async function resolveUserId(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = await prisma.deviceToken.findUnique({
      where: { tokenHash: hashDeviceToken(auth.slice("Bearer ".length)) },
      include: { user: { select: { forgottenAt: true, closedAt: true } } },
    });
    if (!token || token.user.forgottenAt || token.user.closedAt) return null;
    await prisma.deviceToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
    return token.userId;
  }
  const user = await getSessionUser();
  return user?.id ?? null;
}

export async function GET(req: Request) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return unauthorized();

    const params = new URL(req.url).searchParams;
    const offset = Number(params.get("tzOffsetMinutes"));
    const tzOffsetMinutes = Number.isFinite(offset) && Math.abs(offset) <= 14 * 60 ? Math.round(offset) : 0;
    const localeParam = params.get("locale");
    const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

    const snapshot = await buildWidgetSnapshot(userId, { locale, tzOffsetMinutes });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Widget snapshot failed", error);
    return NextResponse.json({ message: "Kunne ikke hente widget-data" }, { status: 500 });
  }
}

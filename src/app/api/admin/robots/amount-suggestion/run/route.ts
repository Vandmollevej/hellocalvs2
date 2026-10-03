import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { loadAmountSuggestionRobot } from "@/lib/robots";
import {
  AMOUNT_SUGGESTION_ROBOT_KEY,
  DEFAULT_AMOUNT_SUGGESTION_SETTINGS,
} from "@/lib/amount-suggestion-config";

// POST /api/admin/robots/amount-suggestion/run — "Kør nu". Robotten ser
// runRequestedAt ved næste tick og kører én gang, også når den er slået fra.
export async function POST() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await prisma.robotConfig.upsert({
    where: { key: AMOUNT_SUGGESTION_ROBOT_KEY },
    create: {
      key: AMOUNT_SUGGESTION_ROBOT_KEY,
      settings: DEFAULT_AMOUNT_SUGGESTION_SETTINGS,
      runRequestedAt: new Date(),
      updatedById: admin.id,
    },
    update: { runRequestedAt: new Date(), updatedById: admin.id },
  });
  return NextResponse.json({ robot: await loadAmountSuggestionRobot() });
}

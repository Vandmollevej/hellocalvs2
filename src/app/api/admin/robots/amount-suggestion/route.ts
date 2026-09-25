import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { loadAmountSuggestionRobot } from "@/lib/robots";
import {
  AMOUNT_SUGGESTION_ROBOT_KEY,
  sanitizeAmountSuggestionSettings,
} from "@/lib/amount-suggestion-config";

// GET /api/admin/robots/amount-suggestion — status + indstillinger til
// robotpanelet (genindlæses, mens en kørsel står på).
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ robot: await loadAmountSuggestionRobot() });
}

// PATCH /api/admin/robots/amount-suggestion — { enabled?, settings? }.
// Robotten læser ændringen ved næste tick (højst et minut).
export async function PATCH(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const data: Prisma.RobotConfigUpdateInput = { updatedById: admin.id };
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.settings !== undefined) data.settings = sanitizeAmountSuggestionSettings(body.settings);

  await prisma.robotConfig.upsert({
    where: { key: AMOUNT_SUGGESTION_ROBOT_KEY },
    create: {
      key: AMOUNT_SUGGESTION_ROBOT_KEY,
      enabled: typeof body.enabled === "boolean" ? body.enabled : true,
      settings: sanitizeAmountSuggestionSettings(body.settings),
      updatedById: admin.id,
    },
    update: data,
  });
  return NextResponse.json({ robot: await loadAmountSuggestionRobot() });
}

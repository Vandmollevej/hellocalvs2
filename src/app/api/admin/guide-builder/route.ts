import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { GUIDE_KINDS, defaultGuideConfig, isGuideKind, sanitizeGuideConfig } from "@/lib/guide-builder";

// GET /api/admin/guide-builder — begge opsætninger (startup-guide + tooltips)
// til admin → Guide-builder. Mangler en række, returneres standarden.
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.guideDesign.findMany();
    const configs = Object.fromEntries(
      GUIDE_KINDS.map((kind) => {
        const row = rows.find((r) => r.kind === kind);
        return [kind, row ? sanitizeGuideConfig(kind, row.config) : defaultGuideConfig(kind)];
      }),
    );
    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Failed to load guide designs", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// PUT /api/admin/guide-builder — gem én opsætning. Body: { kind, config }.
// Opsætningen saniteres altid på serveren (kun faste tokens/roller).
export async function PUT(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  if (!isGuideKind(body.kind)) return NextResponse.json({ message: "Ukendt type" }, { status: 400 });

  const config = sanitizeGuideConfig(body.kind, body.config);
  const json = config as unknown as Prisma.InputJsonValue;
  try {
    const row = await prisma.guideDesign.upsert({
      where: { kind: body.kind },
      create: { kind: body.kind, config: json, updatedById: admin.id },
      update: { config: json, updatedById: admin.id },
    });
    return NextResponse.json({ config, updatedAt: row.updatedAt });
  } catch (error) {
    console.error("Failed to save guide design", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

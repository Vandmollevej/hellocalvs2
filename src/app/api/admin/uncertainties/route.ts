import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import {
  UNCERTAINTY_TABS,
  listUncertaintyPage,
  type UncertaintySort,
  type UncertaintyTabKey,
} from "@/lib/uncertainties";

// GET /api/admin/uncertainties?tab=&sort=&offset=&limit= — ét udsnit af en
// fane på admin "Usikkerheder" til evigheds-scroll/sideinddeling
// (docs/DECISIONS.md 2026-10-11). Lette rækker; detaljer hentes pr. række
// via /api/admin/uncertainties/[id].
const SORTS = new Set<UncertaintySort>(["uncertainty", "created", "name"]);

export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const tabParam = params.get("tab") ?? "";
  const tab = UNCERTAINTY_TABS.find((t) => t.key === tabParam)?.key as UncertaintyTabKey | undefined;
  if (!tab) return NextResponse.json({ message: "Ukendt fane" }, { status: 400 });
  const sortParam = params.get("sort") as UncertaintySort;
  const sort: UncertaintySort = SORTS.has(sortParam) ? sortParam : "uncertainty";
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get("limit") ?? "30", 10) || 30));

  try {
    return NextResponse.json(await listUncertaintyPage(tab, sort, offset, limit));
  } catch (error) {
    console.error("Uncertainty list failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

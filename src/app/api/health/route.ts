import { prisma } from "@/lib/prisma";
import { checkUserSchema, loadFailedMigrations } from "@/lib/deploy-health";
import { getOpenAiUsage } from "@/lib/openai-usage";

export const dynamic = "force-dynamic";

// /api/health: database + brugertabellens kolonner (container-healthcheck —
// ny kode mod en database uden dens migreringer bliver aldrig sund).
// /api/health?deep=1: også fejlede migreringer og OpenAI-status (ekstern
// overvågning, .github/workflows/uptime.yml). OpenAI-status ("ai") gør ikke
// siden usund, men overvågningen slår alarm på den (brugerens krav
// 2026-10-16: tom kredit stod tavst i en log i over et døgn).

// Kun tilstanden, ingen beskeder — ruten er offentlig.
async function aiState(): Promise<string> {
  try {
    const usage = await getOpenAiUsage();
    if (usage.status.state !== "ok") return usage.status.state;
    return usage.balance.configured && usage.balance.low ? "low" : "ok";
  } catch {
    return "error";
  }
}
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  let check = "database";
  try {
    await prisma.$queryRaw`SELECT 1`;
    check = "users";
    await checkUserSchema();
    if (deep) {
      check = "migrations";
      const failed = await loadFailedMigrations();
      if (failed.length > 0) {
        return Response.json(
          { status: "degraded", check, failedMigrations: failed },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    return Response.json(
      deep ? { status: "ok", ai: await aiState() } : { status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Health check failed", check, error);

    return Response.json(
      { status: "unavailable", check },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

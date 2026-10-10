import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  CLICK_WINDOW_MS,
  REFINEMENT_WINDOW_MS,
  classifyNextSearch,
  deviceFromUserAgent,
  normalizeSearchQuery,
  screenFromReferer,
} from "@/lib/search-analytics-rules";

// Søgestatistik (docs/DECISIONS.md 2026-10-10, admin → Analyse → Søgning).
// Fejl her må aldrig vælte en søgning eller et klik.

// Anonym nøgle pr. bruger (eller IP + browser for gæster) pr. døgn. Kun hashen
// gemmes; den kan ikke føres tilbage til en bruger.
function sessionKeyFor(req: Request, userId: string | null | undefined) {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const ua = req.headers.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ADMIN_SESSION_SECRET ?? "hellocal";
  return createHash("sha256")
    .update(`${salt}|${day}|${userId ? `u:${userId}` : `g:${ip}|${ua}`}`)
    .digest("hex")
    .slice(0, 32);
}

export async function recordSearchEvent(
  req: Request,
  input: {
    userId: string | null | undefined;
    query: string;
    region: string;
    resultCount: number;
    fullMatchCount: number;
    engine: "meilisearch" | "postgres";
    correctedQuery?: string;
  },
) {
  try {
    const query = input.query.trim().slice(0, 120);
    if (query.length < 2) return;
    const now = new Date();
    const sessionKey = sessionKeyFor(req, input.userId);
    const previous = await prisma.searchEvent.findFirst({
      where: { sessionKey, updatedAt: { gte: new Date(now.getTime() - REFINEMENT_WINDOW_MS) } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, query: true, updatedAt: true, clickedAt: true, fullMatchCount: true },
    });
    const kind = classifyNextSearch(previous, query, now);
    const data = {
      query,
      normalizedQuery: normalizeSearchQuery(query),
      region: input.region,
      resultCount: input.resultCount,
      fullMatchCount: input.fullMatchCount,
      engine: input.engine,
      correctedQuery: input.correctedQuery ?? null,
    };
    if (kind === "update" && previous) {
      await prisma.searchEvent.update({ where: { id: previous.id }, data });
      return;
    }
    await prisma.searchEvent.create({
      data: {
        ...data,
        sessionKey,
        device: deviceFromUserAgent(req.headers.get("user-agent") ?? ""),
        screen: screenFromReferer(req.headers.get("referer")),
        refinedFromId: kind === "refine" && previous ? previous.id : null,
      },
    });
  } catch (error) {
    console.error("Search event logging failed", error);
  }
}

// Klik på et søgeresultat (POST /api/products/search-event) knyttes til
// brugerens seneste søgning, så raffineringer kan ses som "fandt det til sidst".
export async function recordSearchClick(
  req: Request,
  input: { userId: string | null | undefined; itemId: string; itemType: "product" | "ingredient" | "generic" },
) {
  try {
    const now = new Date();
    const latest = await prisma.searchEvent.findFirst({
      where: {
        sessionKey: sessionKeyFor(req, input.userId),
        clickedAt: null,
        updatedAt: { gte: new Date(now.getTime() - CLICK_WINDOW_MS) },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!latest) return;
    await prisma.searchEvent.update({
      where: { id: latest.id },
      data: { clickedItemId: input.itemId, clickedItemType: input.itemType, clickedAt: now },
    });
  } catch (error) {
    console.error("Search click logging failed", error);
  }
}

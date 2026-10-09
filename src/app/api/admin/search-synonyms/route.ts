import { NextResponse } from "next/server";
import { Locale } from "@prisma/client";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { normalizeSynonymTerm } from "@/lib/search-synonyms";

// GET /api/admin/search-synonyms — the whole synonym dictionary.
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const synonyms = await prisma.searchSynonym.findMany({
    orderBy: [{ language: "asc" }, { termA: "asc" }],
  });
  return NextResponse.json({ synonyms });
}

// POST /api/admin/search-synonyms — { language, termA, termB, similarity }
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const termA = normalizeSynonymTerm(String(body?.termA ?? ""));
  const termB = normalizeSynonymTerm(String(body?.termB ?? ""));
  const language = body?.language === "EN" ? Locale.EN : Locale.DA;
  if (!termA || !termB || termA === termB || termA.length > 80 || termB.length > 80) {
    return NextResponse.json({ message: "Angiv to forskellige ord" }, { status: 400 });
  }
  const [a, b] = termA < termB ? [termA, termB] : [termB, termA];
  try {
    const synonym = await prisma.searchSynonym.create({
      data: { language, termA: a, termB: b, similarity: clampSimilarity(body?.similarity) },
    });
    return NextResponse.json({ synonym });
  } catch {
    return NextResponse.json({ message: "Findes allerede" }, { status: 409 });
  }
}

function clampSimilarity(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 100;
}

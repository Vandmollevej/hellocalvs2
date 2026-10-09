import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  EU_STATUS_LABEL,
  FLAG_LABEL,
  ORIGIN_LABEL,
  canonicalENumber,
  eNumberResearchLinks,
  findENumber,
} from "@/lib/e-number-catalog";

// GET /api/additives/[code] — alt hvad detaljesiden /e-numre/[code] viser for
// ét E-nummer (til den native app): hele katalogposten fra
// src/data/e-numbers.json, varianten man kom fra, de danske mærkater og
// forsknings-/kildelinks. E-numre uden for kataloget får databasens række
// ("fallback"), præcis som sidens Fallback; findes ingen af delene, er både
// entry og fallback null (siden viser så "Ikke i opslagsværket").
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const entry = findENumber(rawCode);
  const requested = canonicalENumber(rawCode);
  const title = entry?.code ?? requested.replace(/\(.*\)$/, "");

  if (entry) {
    return NextResponse.json(
      {
        requested,
        title,
        entry,
        variant: entry.variants.find((item) => item.code === requested) ?? null,
        labels: {
          euStatus: EU_STATUS_LABEL[entry.euStatus],
          origin: ORIGIN_LABEL[entry.origin],
          flags: entry.flags.map((flag) => FLAG_LABEL[flag] ?? flag),
        },
        researchLinks: eNumberResearchLinks(entry),
        fallback: null,
      },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }

  const row = await prisma.additive.findUnique({ where: { eNumber: title } }).catch(() => null);
  return NextResponse.json({
    requested,
    title,
    entry: null,
    variant: null,
    labels: null,
    researchLinks: [],
    fallback: row
      ? {
          eNumber: row.eNumber,
          internationalName: row.internationalName,
          danishName: row.danishName,
          function: row.function,
          risks: row.risks,
          research: row.research,
        }
      : null,
  });
}

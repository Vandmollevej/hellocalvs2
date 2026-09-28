import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listENumbers } from "@/lib/e-number-catalog";

// GET /api/additives — compact E-number lookup for the client (see
// src/lib/additives.ts). The curated catalogue (src/data/e-numbers.json) is
// the primary source; rows only in the "additives" table are appended. Long
// texts stay on the detail page /e-numre/[code].
export async function GET() {
  const catalog = listENumbers().flatMap((entry) => {
    const row = {
      internationalName: entry.nameEn,
      danishName: entry.nameDa,
      function: entry.summary,
      risks: entry.health,
      research: "",
      link: entry.efsa?.url.replace(/^http:\/\/dx\.doi\.org/, "https://doi.org") ?? "",
      source: entry.efsa ? "EFSA" : "",
    };
    return [
      { eNumber: entry.code, ...row },
      ...entry.variants.map((variant) => ({
        eNumber: variant.code.replace(/[()]/g, "").toUpperCase(),
        ...row,
        internationalName: variant.nameEn || row.internationalName,
        danishName: variant.nameDa || row.danishName,
      })),
    ];
  });
  const known = new Set(catalog.map((row) => row.eNumber.toUpperCase()));
  const dbRows = await prisma.additive
    .findMany({ orderBy: { eNumber: "asc" } })
    .catch((error) => {
      console.error("Additive lookup failed", error);
      return [];
    });
  const extra = dbRows
    .filter((row) => !known.has(row.eNumber.toUpperCase()))
    .map(({ eNumber, internationalName, danishName, function: fn, risks, research, link, source }) => ({
      eNumber,
      internationalName,
      danishName,
      function: fn,
      risks,
      research,
      link,
      source,
    }));
  return NextResponse.json(
    { additives: [...catalog, ...extra] },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

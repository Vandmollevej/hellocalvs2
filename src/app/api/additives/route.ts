import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listENumbers } from "@/lib/e-number-catalog";

// GET /api/additives — compact E-number lookup for the client (see
// src/lib/additives.ts). The curated catalogue (src/data/e-numbers.json) is
// the primary source; rows only in the "additives" table are appended. Long
// texts stay on the detail page /e-numre/[code] (GET /api/additives/[code]).
//
// Ud over de oprindelige felter har katalogrækkerne de data, listen på
// /e-numre bruger til filter og mærkater: category, euStatus og variantOf
// (kataloget E-nummer en variantrække hører under, ellers null). Rækker, der
// kun findes i databasen, har category "" og euStatus/variantOf null — de
// vises ikke på /e-numre. Eksisterende klienter ignorerer de ekstra felter.
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
      category: entry.category,
      euStatus: entry.euStatus as string | null,
    };
    return [
      { eNumber: entry.code, ...row, variantOf: null as string | null },
      ...entry.variants.map((variant) => ({
        eNumber: variant.code.replace(/[()]/g, "").toUpperCase(),
        ...row,
        internationalName: variant.nameEn || row.internationalName,
        danishName: variant.nameDa || row.danishName,
        variantOf: entry.code as string | null,
      })),
    ];
  });
  const known = new Set(catalog.map((row) => row.eNumber.toUpperCase()));
  const dbRows = await prisma.additive
    .findMany({ orderBy: { eNumber: "asc" } })
    .catch((error) => {
      console.error("Additive lookup failed", error);
      return [] as Awaited<ReturnType<typeof prisma.additive.findMany>>;
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
      category: "",
      euStatus: null,
      variantOf: null,
    }));
  return NextResponse.json(
    { additives: [...catalog, ...extra] },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

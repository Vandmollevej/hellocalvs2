import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ENumberDirectory } from "./ENumberDirectory";

export const metadata: Metadata = { title: "E-numre" };
export const dynamic = "force-dynamic";

// Samlet E-nummer-side: ét afsnit pr. E-nummer med eget anker (#e330), så
// varer og ingredienslister kan linke direkte til det (DECISIONS 2026-09-28).
export default async function ENumbersPage() {
  const additives = await prisma.additive
    .findMany({
      orderBy: { eNumber: "asc" },
      select: {
        eNumber: true,
        internationalName: true,
        danishName: true,
        function: true,
        risks: true,
        research: true,
        link: true,
        source: true,
      },
    })
    .catch((error) => {
      console.error("E-number page lookup failed", error);
      return [];
    });
  return (
    <ENumberDirectory additives={additives} />
  );
}

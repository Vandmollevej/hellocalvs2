import type { CustomActivityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SPORT_TYPES } from "@/lib/sport-icons";
import type { ActivityTypeRow } from "@/components/admin/ActivityTypeTable";

// Rækker til admin: brugertilføjede aktiviteter (evt. kun med given status)
// og, for den fulde liste, de indbyggede sportstyper — med antal registreringer.
export async function loadActivityTypeRows(options: { status?: CustomActivityStatus; includeBuiltIn?: boolean }) {
  const [custom, usage] = await Promise.all([
    prisma.customActivityType.findMany({
      where: options.status ? { status: options.status } : {},
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.activity.groupBy({ by: ["sportType"], _count: { _all: true } }),
  ]);
  const uses = new Map(usage.map((row) => [row.sportType.toLowerCase(), row._count._all]));
  const rows: ActivityTypeRow[] = custom.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    uses: uses.get(row.normalizedName) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }));
  if (options.includeBuiltIn) {
    rows.push(
      ...SPORT_TYPES.map((sport) => ({
        id: null,
        name: sport.label,
        status: "BUILTIN" as const,
        uses: uses.get(sport.key) ?? 0,
        createdAt: null,
      })),
    );
  }
  return rows;
}

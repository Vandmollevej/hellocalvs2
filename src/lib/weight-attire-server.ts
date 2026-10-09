import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ATTIRE_SETTINGS,
  itemsFromAttire,
  parseAttireItems,
  suggestAttire,
  type AttireItem,
  type AttireSettings,
  type WeighAttire,
} from "@/lib/weigh-attire";

// Serverdel af tøj-gættet (docs/DECISIONS.md 2026-10-07).
export async function getAttireSettings(): Promise<AttireSettings> {
  const row = await prisma.weightAttireSettings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_ATTIRE_SETTINGS;
  return {
    enabled: row.enabled,
    lookbackCount: row.lookbackCount,
    windowHours: row.windowHours,
    underwearBefore: row.underwearBefore,
    syncStaleHours: row.syncStaleHours,
  };
}

export async function attireHistory(userId: string, settings: AttireSettings) {
  const rows = await prisma.weightEntry.findMany({
    where: { userId, attire: { not: null } },
    orderBy: { weighedAt: "desc" },
    take: Math.max(1, settings.lookbackCount),
    select: { weighedAt: true, attire: true, attireItems: true },
  });
  return rows.map((row) => ({
    weighedAt: row.weighedAt,
    // Ældre rækker har kun det gamle ene valg.
    items: row.attireItems.length > 0 ? (parseAttireItems(row.attireItems) ?? []) : itemsFromAttire(row.attire as WeighAttire),
  }));
}

export async function suggestAttireFor(userId: string, at: Date): Promise<AttireItem[]> {
  const settings = await getAttireSettings();
  return suggestAttire(at, await attireHistory(userId, settings), settings);
}

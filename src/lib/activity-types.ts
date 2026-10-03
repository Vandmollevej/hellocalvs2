import { prisma } from "@/lib/prisma";
import { SPORT_TYPES } from "@/lib/sport-icons";

// Aktivitetssøgningen (docs/DECISIONS.md 2026-09-29): de faste sportstyper
// (SPORT_TYPES) + brugertilføjede aktiviteter. Godkendte er synlige for
// alle; en ventende kun for den, der tilføjede den.

export type ActivityOption = {
  key: string;
  label: string;
  custom: boolean;
  pending: boolean;
  /** Ekstra søgeord fra kataloget (synonymer, underformer). */
  words?: string[];
};

export function normalizeActivityName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanActivityName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 60);
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function listActivityOptions(userId: string): Promise<ActivityOption[]> {
  const custom = await prisma.customActivityType.findMany({
    where: { OR: [{ status: "APPROVED" }, { status: "PENDING", createdById: userId }] },
    orderBy: { name: "asc" },
    take: 500,
  });
  // Alfabetisk, så den lange liste er til at finde rundt i; "Anden aktivitet" sidst.
  const builtIn = SPORT_TYPES.filter((sport) => sport.key !== "other")
    .map((sport) => ({ key: sport.key, label: sport.label, custom: false, pending: false, words: sport.words }))
    .sort((a, b) => a.label.localeCompare(b.label, "da"));
  const other = SPORT_TYPES.find((sport) => sport.key === "other");
  const builtInNames = new Set(builtIn.map((option) => normalizeActivityName(option.label)));
  return [
    ...builtIn,
    ...custom
      .filter((row) => !builtInNames.has(row.normalizedName))
      .map((row) => ({ key: row.name, label: row.name, custom: true, pending: row.status === "PENDING" })),
    ...(other ? [{ key: other.key, label: other.label, custom: false, pending: false }] : []),
  ];
}

/** Opretter (eller genbruger) en brugertilføjet aktivitet; nye venter i kvalitetskontrol. */
export async function addCustomActivity(userId: string, rawName: string) {
  const name = cleanActivityName(rawName);
  const normalizedName = normalizeActivityName(name);
  if (normalizedName.length < 2) return null;
  const builtIn = SPORT_TYPES.find((sport) => normalizeActivityName(sport.label) === normalizedName);
  if (builtIn) return { key: builtIn.key, label: builtIn.label, custom: false, pending: false };
  const row = await prisma.customActivityType.upsert({
    where: { normalizedName },
    create: { name, normalizedName, createdById: userId },
    update: {},
  });
  return { key: row.name, label: row.name, custom: true, pending: row.status === "PENDING" };
}

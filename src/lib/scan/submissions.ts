import { prisma } from "@/lib/prisma";

// Aflønningsregler (docs/OPRETTELSES-APP.md "D"):
// - Én global sats (ScanSettings, fastfryses på hver indsendelse).
// - Supplering af et eksisterende produkt tæller som en hel vare — undtagen
//   når det er medarbejderen selv, der oprindeligt oprettede den mangelfulde vare.
// - Admin vurderer altid selv accept/afvisning; manglende energitabel eller
//   ingrediensliste flages ekstra tydeligt.

export async function getPayPerItemOre() {
  const settings = await prisma.scanSettings.findUnique({ where: { id: 1 } });
  return settings?.payPerItemOre ?? 100;
}

export async function isOwnEarlierProduct(workerId: string, productId: string) {
  const own = await prisma.scanSubmission.findFirst({
    where: { workerId, productId, kind: "NEW_PRODUCT" },
    select: { id: true },
  });
  return Boolean(own);
}

export type SubmissionLocation = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  capturedAt: Date;
};

export function parseLocation(body: Record<string, unknown>): SubmissionLocation | null {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const accuracy = Number(body.accuracyM);
  const captured = typeof body.capturedAt === "string" ? new Date(body.capturedAt) : new Date();
  return {
    latitude,
    longitude,
    accuracyM: Number.isFinite(accuracy) ? accuracy : null,
    capturedAt: Number.isNaN(captured.getTime()) || captured > new Date() ? new Date() : captured,
  };
}

// Samlet overblik til Historik / admin: antal og beløb.
export function summarize(rows: { amountOre: number; payable: boolean; reviewStatus: string; payoutId: string | null }[]) {
  const counted = rows.filter((row) => row.payable && row.reviewStatus !== "REJECTED");
  return {
    count: rows.length,
    earnedOre: counted.filter((row) => row.reviewStatus === "ACCEPTED").reduce((sum, row) => sum + row.amountOre, 0),
    paidOre: counted.filter((row) => row.payoutId).reduce((sum, row) => sum + row.amountOre, 0),
    pendingOre: counted.filter((row) => row.reviewStatus === "PENDING").reduce((sum, row) => sum + row.amountOre, 0),
  };
}

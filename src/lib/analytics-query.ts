import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { MIN_COHORT_SIZE, type AnalyticsMetric } from "@/lib/analytics-rules";

// Forespørgsler på den anonyme statistik (docs/PRIVACY.md "Statistik").
// Grupper med færre end MIN_COHORT_SIZE indsendelser vises ikke, og tallene
// får lidt Laplace-støj (differential privacy), så gentagne forespørgsler
// ikke kan bruges til at udlede enkeltpersoner.

const EPSILON = 1;

// Laplace(0, b) via inverse CDF, med kryptografisk tilfældighed.
function laplace(scale: number): number {
  const u = randomInt(1, 2 ** 31 - 1) / 2 ** 31 - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

export type CohortRow = {
  ageBand: string;
  sex: string;
  count: number | null;
  average: number | null;
  suppressed: boolean;
};

export async function cohortAverages(metric: AnalyticsMetric, days: number, country: string | null): Promise<CohortRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsBucket.groupBy({
    by: ["ageBand", "sex"],
    where: { metric, day: { gte: since }, ...(country ? { country } : {}) },
    _sum: { count: true, sum: true },
  });
  return rows
    .map((row) => {
      const count = row._sum.count ?? 0;
      const sum = row._sum.sum ?? 0;
      if (count < MIN_COHORT_SIZE) {
        return { ageBand: row.ageBand, sex: row.sex, count: null, average: null, suppressed: true };
      }
      const noisyCount = Math.max(MIN_COHORT_SIZE, Math.round(count + laplace(1 / EPSILON)));
      const average = sum / count + laplace(1 / (EPSILON * count));
      return { ageBand: row.ageBand, sex: row.sex, count: noisyCount, average, suppressed: false };
    })
    .sort((a, b) => a.ageBand.localeCompare(b.ageBand) || a.sex.localeCompare(b.sex));
}

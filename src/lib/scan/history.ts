import { prisma } from "@/lib/prisma";
import { groupByIsoWeek } from "@/lib/scan/weeks";
import type { WeekGroup } from "@/components/scan/WeekAccordions";

// Data til medarbejderens Historik og Ikke afregnet.

const STATUS_LABEL = { PENDING: "Afventer godkendelse", ACCEPTED: "Godkendt", REJECTED: "Afvist" } as const;

export async function loadWorkerSubmissions(workerId: string, onlyUnsettled: boolean) {
  return prisma.scanSubmission.findMany({
    where: {
      workerId,
      ...(onlyUnsettled ? { payoutId: null, payable: true, reviewStatus: { not: "REJECTED" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true, imageUrl: true, brand: { select: { name: true } } } } },
  });
}

type Rows = Awaited<ReturnType<typeof loadWorkerSubmissions>>;

export function toWeekGroups(rows: Rows, amountOf: (row: Rows[number]) => number, amountLabel: string): WeekGroup[] {
  return groupByIsoWeek(rows, (row) => row.createdAt).map(({ week, rows: weekRows }) => ({
    week,
    amountLabel,
    amountOre: weekRows.reduce((sum, row) => sum + amountOf(row), 0),
    rows: weekRows.map((row) => ({
      id: row.id,
      productName: row.product.name,
      brandName: row.product.brand?.name ?? null,
      imageUrl: row.product.imageUrl,
      storeName: row.storeName,
      statusLabel: row.payoutId ? "Udbetalt" : row.payable ? STATUS_LABEL[row.reviewStatus] : "Tæller ikke (egen vare)",
      amountOre: row.payable ? row.amountOre : 0,
    })),
  }));
}

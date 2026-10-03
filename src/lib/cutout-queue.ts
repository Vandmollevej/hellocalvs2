import { prisma } from "@/lib/prisma";
import { JOB_BY_KEY } from "@/lib/jobs/registry";
import { describeNextRun } from "@/lib/jobs/schedule";

// Admin "Billeder i kø til frilæggelse" (docs/DECISIONS.md 2026-10-02):
// fritlægningsjobs (image_cutout_jobs) som billedrobotten endnu ikke har
// behandlet, plus de fejlede, så admin kan se hvad der ligger og venter.
// Kun læsning — selve jobbet kører i scripts/image-agent/cutout.py.

export type CutoutCropBox = { x: number; y: number; width: number; height: number };

export type CutoutQueueRow = {
  id: string;
  kind: "BRAND_LOGO" | "PRODUCT_FRONT";
  status: "PENDING" | "FAILED";
  sourceUrl: string;
  cropBox: CutoutCropBox | null;
  productName: string | null;
  brandName: string | null;
  recognizedText: string | null;
  createdAt: Date;
  error: string | null;
};

export type CutoutQueue = {
  pending: CutoutQueueRow[];
  failed: CutoutQueueRow[];
  robot: {
    name: string;
    plan: string;
    enabled: boolean;
    runAtTime: string | null;
    notice: string;
    lastRunAt: Date | null;
    lastStatus: string | null;
  };
};

const CUTOUT_JOB_KEY = "image-cutout";
const MAX_ROWS = 500;

function parseCropBox(value: unknown): CutoutCropBox | null {
  if (!value || typeof value !== "object") return null;
  const box = value as Record<string, unknown>;
  const numbers = [box.x, box.y, box.width, box.height];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [x, y, width, height] = numbers as number[];
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export async function loadCutoutQueue(): Promise<CutoutQueue> {
  const definition = JOB_BY_KEY.get(CUTOUT_JOB_KEY);
  const [jobs, schedule] = await Promise.all([
    prisma.imageCutoutJob.findMany({
      where: { status: { in: ["PENDING", "FAILED"] } },
      orderBy: { createdAt: "asc" },
      take: MAX_ROWS,
      include: {
        product: { select: { name: true, brand: { select: { name: true } } } },
        brand: { select: { name: true } },
      },
    }),
    prisma.scheduledJob.findUnique({ where: { key: CUTOUT_JOB_KEY } }),
  ]);

  const rows: CutoutQueueRow[] = jobs.map((job) => ({
    id: job.id,
    kind: job.kind,
    status: job.status === "FAILED" ? "FAILED" : "PENDING",
    sourceUrl: job.sourceUrl,
    cropBox: parseCropBox(job.cropBox),
    productName: job.product?.name ?? null,
    brandName: job.brand?.name ?? job.product?.brand?.name ?? null,
    recognizedText: job.recognizedText,
    createdAt: job.createdAt,
    error: job.error,
  }));

  const state = {
    enabled: schedule?.enabled ?? true,
    runAtTime: schedule ? schedule.runAtTime : (definition?.defaultRunAtTime ?? null),
    intervalMinutes: schedule ? schedule.intervalMinutes : (definition?.defaultIntervalMinutes ?? null),
    runRequestedAt: schedule?.runRequestedAt ?? null,
    lastStartedAt: schedule?.lastStartedAt ?? null,
  };

  return {
    pending: rows.filter((row) => row.status === "PENDING"),
    failed: rows.filter((row) => row.status === "FAILED"),
    robot: {
      name: definition?.name ?? "Billedrobot: fritlægning",
      plan: describeNextRun(state),
      enabled: state.enabled,
      runAtTime: state.runAtTime,
      notice: describeScanNotice(state),
      lastRunAt: schedule?.lastRunAt ?? null,
      lastStatus: schedule?.lastStatus ?? null,
    },
  };
}

// Beskeden under køen følger robottens rigtige plan, så den aldrig lyver
// (ejerens valg 2026-10-03: planen forbliver "Løbende").
function describeScanNotice(state: { enabled: boolean; runAtTime: string | null; intervalMinutes: number | null }): string {
  if (!state.enabled) return "Robotten er slået fra — billederne scannes ikke, før den slås til igen.";
  if (state.runAtTime) return `Disse billeder vil blive scannet i nat kl. ${state.runAtTime}.`;
  return "Disse billeder bliver scannet løbende.";
}

export function formatCopenhagenDateTime(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

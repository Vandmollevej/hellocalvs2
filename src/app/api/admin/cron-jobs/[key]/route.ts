import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { JOB_BY_KEY } from "@/lib/jobs/registry";
import { parseRunAtTime } from "@/lib/jobs/schedule";

// Admin "Cron-jobs" (docs/DECISIONS.md 2026-09-25): pause/genoptag, fast
// klokkeslæt eller interval, og "kør nu". Selve kørslen sker i app-
// processens scheduler eller i agentens container inden for et minut.
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { key } = await params;
  const job = JOB_BY_KEY.get(key);
  if (!job) return NextResponse.json({ message: "Ukendt job" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  const data: {
    enabled?: boolean;
    runAtTime?: string | null;
    intervalMinutes?: number | null;
    runRequestedAt?: Date;
  } = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.runNow === true) data.runRequestedAt = new Date();
  if ("schedule" in body) {
    const schedule = body.schedule as { type?: unknown; value?: unknown } | null;
    if (schedule?.type === "time") {
      const value = typeof schedule.value === "string" ? schedule.value.trim() : "";
      if (parseRunAtTime(value) === null) return NextResponse.json({ message: "Angiv tidspunkt som TT:MM" }, { status: 400 });
      data.runAtTime = value.padStart(5, "0");
      data.intervalMinutes = null;
    } else if (schedule?.type === "interval") {
      const minutes = Number(schedule.value);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 7 * 24 * 60) {
        return NextResponse.json({ message: "Interval skal være 1–10080 minutter" }, { status: 400 });
      }
      data.intervalMinutes = minutes;
      data.runAtTime = null;
    } else if (schedule?.type === "manual") {
      data.intervalMinutes = null;
      data.runAtTime = null;
    } else {
      return NextResponse.json({ message: "Ugyldig plan" }, { status: 400 });
    }
  }

  const row = await prisma.scheduledJob.upsert({
    where: { key },
    create: {
      key,
      intervalMinutes: job.defaultIntervalMinutes,
      runAtTime: job.defaultRunAtTime,
      ...data,
    },
    update: data,
  });
  return NextResponse.json({ job: row });
}

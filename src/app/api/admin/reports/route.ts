import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { nextRunAfter, reportRecipients, sendPartnerReport, type Frequency } from "@/lib/partner-reports";

// Admin "Rapporter" (docs/DECISIONS.md 2026-09-29). Klienten sender kun
// partnerId (+ periode/interval) — modtagerne findes altid server-side ud fra
// partnerens egne kontakter. "confirmEmails" skal matche modtagerlisten, som
// admin så i bekræftelsesdialogen, ellers afvises afsendelsen.
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const FREQS: Frequency[] = ["WEEKLY", "MONTHLY"];

export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  const partnerId = str(body.partnerId);

  if (body.action === "send") {
    const days = Math.min(Math.max(Number(body.days) || 30, 1), 365);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const expected = (await reportRecipients(partnerId)).map((c) => c.email.trim().toLowerCase()).sort().join(",");
    const confirmed = Array.isArray(body.confirmEmails)
      ? (body.confirmEmails as unknown[]).map((e) => str(e).toLowerCase()).sort().join(",")
      : "";
    if (!expected || expected !== confirmed) {
      return NextResponse.json({ message: "Modtagerlisten har ændret sig — åbn bekræftelsen igen" }, { status: 409 });
    }
    const result = await sendPartnerReport(partnerId, { from, to, trigger: "MANUAL" });
    return NextResponse.json(result, { status: result.sent > 0 ? 200 : 422 });
  }

  if (body.action === "createSchedule") {
    const frequency = str(body.frequency) as Frequency;
    if (!FREQS.includes(frequency)) return NextResponse.json({ message: "Ugyldigt interval" }, { status: 400 });
    if ((await reportRecipients(partnerId)).length === 0) {
      return NextResponse.json({ message: "Partneren har ingen aktive kontakter" }, { status: 422 });
    }
    await prisma.partnerReportSchedule.create({ data: { partnerId, frequency, nextRunAt: nextRunAfter(frequency, new Date()) } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggleSchedule") {
    await prisma.partnerReportSchedule.update({ where: { id: str(body.id) }, data: { enabled: body.enabled === true } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "deleteSchedule") {
    await prisma.partnerReportSchedule.delete({ where: { id: str(body.id) } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Ukendt handling" }, { status: 400 });
}

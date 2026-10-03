import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import {
  getPartnerPerformance,
  parsePeriod,
  performanceCsv,
  performanceFileBase,
  performancePdf,
  sendPerformanceReport,
  type PerformanceFormat,
} from "@/lib/partner-performance";

// Partnersidens performance (docs/DECISIONS.md 2026-10-02).
//  GET  ?from=&to=&onlyTriggered=1&format=json|csv|pdf  → data eller fil
//  POST { from, to, onlyTriggered, name, email, formats: ["pdf","csv"] } → mail
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  const { from, to } = parsePeriod(url.searchParams.get("from"), url.searchParams.get("to"));
  const onlyTriggered = url.searchParams.get("onlyTriggered") === "1";
  const perf = await getPartnerPerformance(id, from, to, { onlyTriggered });
  if (!perf) return NextResponse.json({ message: "Partneren findes ikke" }, { status: 404 });

  const format = url.searchParams.get("format");
  const base = performanceFileBase(perf);
  if (format === "csv") {
    return new NextResponse(performanceCsv(perf), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
    });
  }
  if (format === "pdf") {
    return new NextResponse(new Uint8Array(performancePdf(perf)), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` },
    });
  }
  return NextResponse.json(perf);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const { from, to } = parsePeriod(str(body.from) || null, str(body.to) || null);
  const perf = await getPartnerPerformance(id, from, to, { onlyTriggered: body.onlyTriggered === true });
  if (!perf) return NextResponse.json({ message: "Partneren findes ikke" }, { status: 404 });
  const formats = (Array.isArray(body.formats) ? body.formats : []).filter((f): f is PerformanceFormat => f === "pdf" || f === "csv");
  const result = await sendPerformanceReport(perf, { toName: str(body.name), toEmail: str(body.email), formats });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

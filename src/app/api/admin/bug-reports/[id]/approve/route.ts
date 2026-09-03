import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { approveBugReport } from "@/lib/bug-report-approval";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await approveBugReport(id);
  if (!report) return NextResponse.json({ message: "Fejlrapporten findes ikke" }, { status: 404 });
  return NextResponse.json({ bugReport: report });
}

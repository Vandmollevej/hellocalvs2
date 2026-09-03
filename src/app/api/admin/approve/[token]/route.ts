import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveProduct, rejectProduct } from "@/lib/product-approval";
import { approveBugReport, rejectBugReport } from "@/lib/bug-report-approval";

// Login-frit admin-godkendelseslink (docs/DECISIONS.md 2026-09-02): token er
// den eneste adgangskontrol her — sikkerheden kommer fra at approvalToken er
// et uigætligt cuid() kun kendt fra mailen, og bliver ryddet (sat til null)
// af approveProduct/rejectProduct/approveBugReport/rejectBugReport, så
// linket kun kan bruges én gang.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ message: "Ukendt handling" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { approvalToken: token } });
  if (product) {
    const result = body.action === "approve" ? await approveProduct(product.id) : await rejectProduct(product.id);
    return NextResponse.json({ product: result });
  }

  const bugReport = await prisma.bugReport.findUnique({ where: { approvalToken: token } });
  if (bugReport) {
    const result =
      body.action === "approve" ? await approveBugReport(bugReport.id) : await rejectBugReport(bugReport.id);
    return NextResponse.json({ bugReport: result });
  }

  return NextResponse.json({ message: "Linket er ikke gyldigt eller er allerede brugt" }, { status: 404 });
}

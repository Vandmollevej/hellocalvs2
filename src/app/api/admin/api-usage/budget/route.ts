import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { getApiUsageOverview, saveBudget } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

function amount(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : Number.NaN;
}

// Månedsbudget og pris pr. kald for én tjeneste (tom = intet budget / standardpris).
export async function PUT(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { serviceId?: string; monthlyBudget?: unknown; unitPrice?: unknown };
  const budget = amount(body.monthlyBudget);
  const price = amount(body.unitPrice);
  if (Number.isNaN(budget) || Number.isNaN(price)) {
    return NextResponse.json({ message: "Skriv beløbene som tal." }, { status: 400 });
  }
  try {
    await saveBudget(String(body.serviceId ?? ""), budget, price);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Kunne ikke gemme" }, { status: 400 });
  }
  return NextResponse.json(await getApiUsageOverview());
}

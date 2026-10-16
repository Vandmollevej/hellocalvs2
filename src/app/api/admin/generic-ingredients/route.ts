import { NextResponse } from "next/server";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import {
  createGenericProduct,
  GenericProductError,
  inputFromJson,
  listGenericProducts,
  parseListFilters,
} from "@/lib/generic-product-admin";

// GET ?q=&category=&source=&status=&page= — næste udsnit af admin-listen
// (evigheds-scroll/sideinddelt, docs/REGLER.md "Lange admin-lister").
export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  return NextResponse.json(await listGenericProducts(parseListFilters(params), page));
}

// POST — opret ét generisk produkt manuelt (admin → Varer → Generiske
// produkter, docs/DECISIONS.md 2026-10-15).
export async function POST(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const ingredient = await createGenericProduct(inputFromJson(body), admin.id);
    return NextResponse.json({ ok: true, id: ingredient.id });
  } catch (error) {
    if (error instanceof GenericProductError) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Generic product create failed", error);
    return NextResponse.json({ message: "Kunne ikke gemme" }, { status: 500 });
  }
}

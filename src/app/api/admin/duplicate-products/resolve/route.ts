import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { DUPLICATE_FIELDS, type DuplicateFieldValues } from "@/lib/duplicate-fields";
import { applyFieldValues, dismissProductSet, MAX_COLUMNS, mergeProductInto } from "@/lib/duplicate-review";

// POST /api/admin/duplicate-products/resolve — "Gem endelig" / "Ikke
// dubletter" på admin "Dubletter" → Produkter (docs/DECISIONS.md 2026-09-28).
// { action: "save" | "dismiss", kind: "sources" | "products",
//   productIds, keepProductId, values }
// - sources: ét produkt med Bilka + REMA 1000-data. save skriver de valgte
//   værdier; begge gemmer butiksdataene som gennemgået.
// - products: 2–6 produkter. save skriver værdierne på keepProductId og
//   fletter de øvrige ind i det (registreringer beholder deres snapshot);
//   dismiss gemmer gruppen som "ikke dubletter".
const EDITABLE = new Set(DUPLICATE_FIELDS.filter((f) => !f.readOnly).map((f) => f.key));

function cleanValues(raw: unknown): DuplicateFieldValues {
  const out: DuplicateFieldValues = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!EDITABLE.has(key)) continue;
    if (value === null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.filter((v): v is string => typeof v === "string");
    }
  }
  return out;
}

export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const action = body.action === "dismiss" ? "dismiss" : "save";
  const kind = body.kind === "sources" ? "sources" : "products";
  const productIds = Array.isArray(body.productIds)
    ? [...new Set(body.productIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  const keepProductId = typeof body.keepProductId === "string" ? body.keepProductId : "";
  const values = cleanValues(body.values);

  if (productIds.length === 0 || productIds.length > MAX_COLUMNS) {
    return NextResponse.json({ message: "Ugyldigt antal produkter" }, { status: 400 });
  }
  const found = await prisma.product.count({ where: { id: { in: productIds } } });
  if (found !== productIds.length) {
    return NextResponse.json({ message: "Et af produkterne findes ikke længere — genindlæs siden" }, { status: 409 });
  }

  try {
    if (kind === "sources") {
      const productId = productIds[0];
      await prisma.$transaction(async (tx) => {
        if (action === "save") await applyFieldValues(tx, productId, values);
        await tx.productSourceRecord.updateMany({ where: { productId }, data: { reviewedAt: new Date() } });
      });
      return NextResponse.json({ ok: true, productId });
    }

    if (productIds.length < 2) {
      return NextResponse.json({ message: "Der skal være mindst to produkter" }, { status: 400 });
    }
    if (action === "dismiss") {
      await dismissProductSet(productIds);
      return NextResponse.json({ ok: true });
    }
    if (!productIds.includes(keepProductId)) {
      return NextResponse.json({ message: "Vælg hvilket produkt der er det endelige" }, { status: 400 });
    }
    await prisma.$transaction(
      async (tx) => {
        await applyFieldValues(tx, keepProductId, values);
        for (const id of productIds) {
          if (id !== keepProductId) await mergeProductInto(tx, keepProductId, id);
        }
      },
      { timeout: 30_000 },
    );
    return NextResponse.json({ ok: true, productId: keepProductId });
  } catch (error) {
    console.error("Duplicate resolve failed", error);
    return NextResponse.json({ message: "Kunne ikke gemme" }, { status: 500 });
  }
}

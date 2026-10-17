import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { fetchOffProductRaw } from "@/lib/openFoodFacts";
import { importOffProducts, resplitOffRecords, saveOffRecord } from "@/lib/off-store";
import { petFoodBlockReason } from "@/lib/pet-food-blacklist";
import { prisma } from "@/lib/prisma";
import { queueExternalEnrichment } from "@/lib/external-enrichment";

// Admin → Varedatabase → Open Food Facts (docs/DECISIONS.md 2026-10-11).
//   { op: "import", products: [...] }   gem et udtræk (liste af OFF-vareobjekter), højst 150 ad gangen
//   { op: "fetch", barcode }            hent én stregkode fra Open Food Facts og gem den
//   { op: "resplit", afterId }          kør opdelingen igen på de gemte rå svar (én portion ad gangen)
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (admin.adminAccessLevel !== "FULL") {
    return NextResponse.json({ message: "Kun administratorer med fuld adgang kan ændre OFF-varer." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const op = typeof body?.op === "string" ? body.op : "";

  try {
    if (op === "import") {
      const products = Array.isArray(body?.products) ? (body!.products as unknown[]) : null;
      if (!products) return NextResponse.json({ message: "products mangler" }, { status: 400 });
      if (products.length > 150) return NextResponse.json({ message: "Højst 150 varer ad gangen" }, { status: 400 });
      const result = await importOffProducts(products, "IMPORT");
      return NextResponse.json({ ok: true, ...result });
    }

    if (op === "fetch") {
      const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
      if (barcode.length < 6 || barcode.length > 14) {
        return NextResponse.json({ message: "Ugyldig stregkode" }, { status: 400 });
      }
      const raw = await fetchOffProductRaw(barcode);
      if (!raw) return NextResponse.json({ ok: false, message: "Open Food Facts kender ikke stregkoden" }, { status: 404 });
      const block = await petFoodBlockReason({
        barcode,
        texts: [String(raw.product_name ?? ""), String(raw.brands ?? ""), String(raw.ingredients_text ?? "")],
      });
      if (block) return NextResponse.json({ ok: false, message: "Dyrefoder — gemmes ikke" }, { status: 422 });
      const linked = await prisma.barcode.findUnique({ where: { code: barcode }, select: { productId: true } });
      const saved = await saveOffRecord({ barcode, raw, source: "ADMIN", productId: linked?.productId ?? null });
      // Varen med stregkoden får OFF flettet ind i baggrunden (bruger 2026-10-17).
      if (linked) queueExternalEnrichment([linked.productId], "admin");
      return NextResponse.json({
        ok: true,
        barcode,
        confidence: saved.split.confidence,
        title: saved.split.title,
        message: `Gemt: ${saved.split.title || barcode} (${saved.split.confidence} % sikker)`,
      });
    }

    if (op === "resplit") {
      const afterId = typeof body?.afterId === "string" && body.afterId ? body.afterId : null;
      const result = await resplitOffRecords({ afterId, take: 400 });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
  } catch (error) {
    console.error("Admin OFF action failed", error);
    return NextResponse.json({ message: "Handlingen mislykkedes" }, { status: 500 });
  }
}

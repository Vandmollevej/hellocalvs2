import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as createHelloCalProduct } from "@/app/api/products/route";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { getPayPerItemOre, isOwnEarlierProduct, parseLocation } from "@/lib/scan/submissions";
import { lookupStoreName } from "@/lib/scan/storage";

// "Opret vare" i Oprettelses-appen (docs/OPRETTELSES-APP.md). Produktet
// oprettes "på præcis samme måde" som i Hello Cal: body'en sendes uændret
// videre til POST /api/products, så produktet er synligt i Hello Cal med det
// samme. Derefter registreres arbejdet som en ScanSubmission til aflønning.
//
// Findes stregkoden allerede, er det en supplering: kun tomme felter på det
// eksisterende produkt udfyldes (intet overskrives), og arbejdet tæller som
// en hel vare — undtagen hvis medarbejderen selv oprettede produktet.
const SCAN_ONLY_KEYS = ["latitude", "longitude", "accuracyM", "capturedAt", "shelfPhotoItemId", "hasNutritionPhoto"];

export async function POST(req: Request) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  const location = parseLocation(body);
  if (!location) return NextResponse.json({ message: "Lokation mangler — slå lokation til" }, { status: 400 });

  const productBody = Object.fromEntries(Object.entries(body).filter(([key]) => !SCAN_ONLY_KEYS.includes(key)));
  const shelfPhotoItemId = typeof body.shelfPhotoItemId === "string" && body.shelfPhotoItemId ? body.shelfPhotoItemId : null;
  const shelfItem = shelfPhotoItemId
    ? await prisma.shelfPhotoItem.findFirst({ where: { id: shelfPhotoItemId, shelfPhoto: { workerId: worker.id } } })
    : null;

  const barcode = typeof productBody.barcode === "string" ? productBody.barcode.trim() : "";
  const ingredientsText = typeof productBody.ingredientsText === "string" ? productBody.ingredientsText.trim() : "";
  const imageUrl = typeof productBody.imageUrl === "string" ? productBody.imageUrl : null;
  const analysisIds = (productBody.analysisIds ?? {}) as Record<string, unknown>;
  const hasNutritionPhoto = Boolean(body.hasNutritionPhoto) || typeof analysisIds.nutrition === "string";

  const existing = barcode
    ? await prisma.barcode.findUnique({ where: { code: barcode }, include: { product: true } })
    : null;

  let productId: string;
  let kind: "NEW_PRODUCT" | "SUPPLEMENT";
  let payable = true;

  if (existing) {
    const product = existing.product;
    kind = "SUPPLEMENT";
    payable = !(await isOwnEarlierProduct(worker.id, product.id));
    await prisma.product.update({
      where: { id: product.id },
      data: {
        imageUrl: product.imageUrl ?? imageUrl ?? undefined,
        ingredientsText: product.ingredientsText ?? (ingredientsText || undefined),
      },
    });
    productId = product.id;
  } else {
    const response = await createHelloCalProduct(
      new Request(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productBody),
      }),
    );
    const data = (await response.json().catch(() => ({}))) as { product?: { id: string }; message?: string };
    if (!response.ok || !data.product) {
      return NextResponse.json({ message: data.message ?? "Produktet kunne ikke oprettes" }, { status: response.status || 500 });
    }
    productId = data.product.id;
    kind = "NEW_PRODUCT";
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { ingredientsText: true } });
  const submission = await prisma.scanSubmission.create({
    data: {
      workerId: worker.id,
      productId,
      shelfPhotoItemId: shelfItem?.id,
      kind,
      payable,
      missingEnergy: !hasNutritionPhoto,
      missingIngredients: !product?.ingredientsText,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyM: location.accuracyM,
      capturedAt: location.capturedAt,
      storeName: await lookupStoreName(location.latitude, location.longitude),
      amountOre: await getPayPerItemOre(),
    },
  });

  // Varen holdt op mod hyldebilledet → grønt flueben med det samme.
  if (shelfItem) {
    await prisma.shelfPhotoItem.update({
      where: { id: shelfItem.id },
      data: { productId, status: "EXISTS", matchConfidence: 1, manuallyAssigned: true },
    });
  }

  return NextResponse.json({ productId, submissionId: submission.id, kind, payable }, { status: 201 });
}

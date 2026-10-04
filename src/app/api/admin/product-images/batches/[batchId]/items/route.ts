import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";
import { ingestProductImage, parseProductImageMeta } from "@/lib/product-image-upload";
import { PRODUCT_IMAGE_MAX_UPLOAD_BYTES } from "@/lib/product-image-upload-types";

// POST /api/admin/product-images/batches/[batchId]/items — én billedfil i et parti.
// multipart/form-data: `meta` (JSON: filnavn, originale mål/størrelse, browserens
// procestrin, evt. `failed`) og `file` (det klargjorte billede; udeladt ved fejl).
export async function POST(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { batchId } = await params;
  const batch = await prisma.productImageUploadBatch.findUnique({ where: { id: batchId }, select: { id: true } });
  if (!batch) return NextResponse.json({ message: "Partiet findes ikke" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  let rawMeta: unknown;
  try {
    rawMeta = JSON.parse(String(form.get("meta") ?? ""));
  } catch {
    return NextResponse.json({ message: "Mangler oplysninger om filen" }, { status: 400 });
  }
  const meta = parseProductImageMeta(rawMeta);
  if (!meta) return NextResponse.json({ message: "Mangler filnavn" }, { status: 400 });

  const file = form.get("file");
  let buffer: Buffer | null = null;
  if (file instanceof Blob) {
    if (file.size > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) {
      return NextResponse.json({ message: "Filen er for stor" }, { status: 413 });
    }
    buffer = Buffer.from(await file.arrayBuffer());
  }

  try {
    const item = await ingestProductImage(batchId, meta, buffer);
    return NextResponse.json({ item });
  } catch (error) {
    console.error("product-image upload failed", error);
    return NextResponse.json({ message: "Kunne ikke gemme billedet" }, { status: 500 });
  }
}

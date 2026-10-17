import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { ingestRembgFile, REMBG_MAX_BYTES } from "@/lib/image-review";

// POST /api/admin/image-review/upload — én rembg-fil ad gangen (multipart:
// `file`, `batchId`). Filnavnet skal indeholde varens EAN. Svaret siger, om
// filen kom på Afventer, Eksisterende (varen har allerede et fritlagt billede)
// eller Ikke matchet. Se docs/DECISIONS.md 2026-10-17.
export async function POST(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const file = form.get("file");
  const batchId = String(form.get("batchId") ?? "").slice(0, 64) || "manual";
  if (!(file instanceof File)) return NextResponse.json({ message: "Mangler fil" }, { status: 400 });
  if (file.size > REMBG_MAX_BYTES) return NextResponse.json({ message: "Filen er for stor" }, { status: 413 });

  try {
    const result = await ingestRembgFile({
      fileName: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
      batchId,
      adminId: admin.id,
    });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("rembg upload failed", error);
    return NextResponse.json({ message: "Kunne ikke gemme billedet" }, { status: 500 });
  }
}

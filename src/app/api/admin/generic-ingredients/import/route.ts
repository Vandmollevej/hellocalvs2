import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { readTableFile } from "@/lib/table-file-read";
import { GenericProductError, importGenericProducts, previewImport } from "@/lib/generic-product-admin";

const MAX_BYTES = 10 * 1024 * 1024;

// POST multipart { file, mode: "preview" | "commit" } — CSV/.xlsx med samme
// kolonner som "Generiske produkter.xlsx". "preview" viser fejl pr. række;
// "commit" opretter de gyldige rækker og springer resten over.
export async function POST(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "Vælg en fil" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ message: "Filen er større end 10 MB" }, { status: 400 });

  let table: string[][];
  try {
    table = readTableFile(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Filen kunne ikke læses" }, { status: 400 });
  }

  try {
    if (form?.get("mode") === "commit") return NextResponse.json({ ok: true, ...(await importGenericProducts(table, admin.id)) });
    return NextResponse.json({ ok: true, ...(await previewImport(table)) });
  } catch (error) {
    if (error instanceof GenericProductError) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Generic product import failed", error);
    return NextResponse.json({ message: "Importen fejlede" }, { status: 500 });
  }
}

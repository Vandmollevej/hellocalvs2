import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import {
  deleteGenericProduct,
  GenericProductError,
  inputFromJson,
  restoreGenericProduct,
  updateGenericProduct,
} from "@/lib/generic-product-admin";

type Params = { params: Promise<{ id: string }> };

function fail(error: unknown) {
  if (error instanceof GenericProductError) return NextResponse.json({ message: error.message }, { status: 400 });
  console.error("Generic product change failed", error);
  return NextResponse.json({ message: "Kunne ikke gemme" }, { status: 500 });
}

// PATCH { ...felter } — redigér; PATCH { action: "restore" } — gendan arkiveret.
export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.action === "restore") await restoreGenericProduct(id);
    else await updateGenericProduct(id, inputFromJson(body));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

// DELETE — slet; bruges produktet i registreringer, arkiveres det i stedet.
export async function DELETE(_req: Request, { params }: Params) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, result: await deleteGenericProduct(id) });
  } catch (error) {
    return fail(error);
  }
}

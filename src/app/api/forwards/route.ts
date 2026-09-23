import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createForward } from "@/lib/forwards";
import { isBase64Url } from "@/lib/vault/server";

// POST { kind, productId?, iv, ciphertext } — opretter et videresendelseslink.
// iv/ciphertext er krypteret på afsenderens enhed (navn og evt. ret);
// nøglen sendes aldrig hertil.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at videresende" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = body?.kind === "DISH" ? "DISH" : body?.kind === "PRODUCT" ? "PRODUCT" : null;
  const productId = typeof body?.productId === "string" ? body.productId : null;
  if (!kind || (kind === "PRODUCT" && !productId)) {
    return NextResponse.json({ message: "productId mangler" }, { status: 400 });
  }
  if (!isBase64Url(body?.iv, 32) || !isBase64Url(body?.ciphertext, 256 * 1024)) {
    return NextResponse.json({ message: "Ugyldig videresendelse" }, { status: 400 });
  }

  const forward = await createForward(user.id, kind, productId, {
    iv: body!.iv as string,
    ciphertext: body!.ciphertext as string,
  });
  return NextResponse.json({ forward }, { status: 201 });
}

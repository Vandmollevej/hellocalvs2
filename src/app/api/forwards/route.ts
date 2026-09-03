import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createForward } from "@/lib/forwards";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at videresende" }, { status: 401 });

  let body: { kind?: string; productId?: string; dishId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const kind = body.kind === "DISH" ? "DISH" : body.kind === "PRODUCT" ? "PRODUCT" : null;
  const itemId = kind === "DISH" ? body.dishId : body.productId;
  if (!kind || !itemId) {
    return NextResponse.json({ message: "productId eller dishId mangler" }, { status: 400 });
  }

  const forward = await createForward(user.id, kind, itemId);
  return NextResponse.json({ forward }, { status: 201 });
}

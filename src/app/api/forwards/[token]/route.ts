import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { ForwardError, fulfillForward, openForward } from "@/lib/forwards";

type RouteContext = { params: Promise<{ token: string }> };

// POST { action: "open" | "fulfill" } — modtagersiden (docs/PRIVACY.md).
// "open" returnerer linkets krypterede indhold; "fulfill" melder, at varen
// er tilføjet, så afsenderen kan få points. Modtageren gemmes ikke.
export async function POST(req: Request, { params }: RouteContext) {
  const { token } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at åbne linket" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;

  if (body?.action === "open") {
    try {
      const forward = await openForward(token, user.id);
      if (!forward) return NextResponse.json({ message: "Linket er ikke gyldigt." }, { status: 404 });
      return NextResponse.json({
        forward: {
          kind: forward.kind,
          productId: forward.productId,
          status: forward.status,
          iv: forward.payloadIv,
          ciphertext: forward.payloadCiphertext,
        },
      });
    } catch (error) {
      if (error instanceof ForwardError) return NextResponse.json({ message: error.message }, { status: 400 });
      throw error;
    }
  }

  if (body?.action === "fulfill") {
    return NextResponse.json({ fulfilled: await fulfillForward(token, user.id) });
  }

  return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
}

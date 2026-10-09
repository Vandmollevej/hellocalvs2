import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { FORWARD_SENDER_FALLBACK, loadForwardView } from "@/lib/forward-view";

// GET /api/forwards/[token] — samme opslag som siden /forward/[token] (til den
// native app): kræver login og claimer forwarden for den indloggede bruger ved
// første kald (recipientId + OPENED, krydsspærring), præcis som siden.
// Points til afsenderen gives først, når modtageren tilføjer varen via
// POST /api/registrations (fulfillMatchingForward).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Log ind for at se hvad din ven har sendt dig." }, { status: 401 });
  }

  const view = await loadForwardView(token, user.id);

  if (view.status === "error") {
    return NextResponse.json(
      { code: view.reason, message: view.message },
      { status: view.reason === "abuse" ? 403 : 500 },
    );
  }
  if (view.status !== "ok") {
    return NextResponse.json({ code: view.status, message: view.message }, { status: 404 });
  }

  return NextResponse.json({
    forward: {
      kind: view.kind,
      item: view.item,
      senderDisplayName: view.senderDisplayName,
      senderName: view.senderDisplayName ?? FORWARD_SENDER_FALLBACK,
      amountGrams: view.amountGrams,
    },
  });
}

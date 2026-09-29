import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { StripeError } from "@/lib/payments/stripe-client";
import { syncStripeReturn } from "@/lib/payments/stripe-subscription";

// Retursiden kalder denne med Checkout-sessionens id, så abonnementet kobles
// med det samme — uden at vente på webhooken.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = typeof body.sessionId === "string" && /^cs_[A-Za-z0-9_]+$/.test(body.sessionId) ? body.sessionId : null;
  try {
    return NextResponse.json({ state: await syncStripeReturn(user.id, sessionId) });
  } catch (error) {
    console.error("[stripe] sync fejlede", error instanceof StripeError ? error.body : error);
    return NextResponse.json({ state: "pending" });
  }
}

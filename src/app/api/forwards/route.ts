import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createForward } from "@/lib/forwards";
import { forwardUrl } from "@/lib/forward-link";
import { sendTransientMail } from "@/lib/transient-mail";

// Hvor længe linket virker (timer). Videresend ret: brugeren vælger i popuppen.
const ALLOWED_HOURS = [24, 24 * 7, 24 * 30, 24 * 90];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// POST /api/forwards — opretter en videresendelse og returnerer et krypteret
// link (`link`). Valgfrie felter (kun ret): expiresInHours, recipientName,
// recipientEmail, message, fromName. Er recipientEmail sat, sendes linket
// også på mail (best effort — delearket er den primære vej).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at videresende" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const kind = body.kind === "DISH" ? "DISH" : body.kind === "PRODUCT" ? "PRODUCT" : null;
  const itemId = kind === "DISH" ? body.dishId : body.productId;
  if (!kind || typeof itemId !== "string" || !itemId) {
    return NextResponse.json({ message: "productId eller dishId mangler" }, { status: 400 });
  }

  const hours = typeof body.expiresInHours === "number" ? body.expiresInHours : null;
  if (hours !== null && !ALLOWED_HOURS.includes(hours)) {
    return NextResponse.json({ message: "Ugyldig varighed" }, { status: 400 });
  }
  const recipientEmail = text(body.recipientEmail, 200);
  if (recipientEmail && !EMAIL.test(recipientEmail)) {
    return NextResponse.json({ message: "Ugyldig e-mailadresse" }, { status: 400 });
  }
  const expiresAt = hours ? new Date(Date.now() + hours * 3_600_000) : null;
  const recipientName = text(body.recipientName, 100);
  const message = text(body.message, 1000);
  const fromName = text(body.fromName, 100);

  const forward = await createForward(user.id, kind, itemId, { expiresAt, recipientName, recipientEmail, message, fromName });
  const link = forwardUrl(forward.token, expiresAt);

  if (recipientEmail) {
    const sender = escapeHtml(fromName ?? "En ven");
    try {
      await sendTransientMail({
        to: recipientEmail,
        subject: `${fromName ?? "En ven"} har sendt dig en ret i Hello Cal`,
        html:
          `<p>Hej${recipientName ? ` ${escapeHtml(recipientName)}` : ""},</p>` +
          `<p>${sender} har sendt dig en ret i Hello Cal.</p>` +
          (message ? `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : "") +
          `<p><a href="${link}">Åbn retten</a></p>` +
          (expiresAt ? `<p>Linket virker til ${expiresAt.toLocaleDateString("da-DK")}.</p>` : ""),
        devLink: link,
      });
    } catch (error) {
      console.error("Forward mail failed", error);
    }
  }

  return NextResponse.json({ forward, link }, { status: 201 });
}

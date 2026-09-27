import { getSessionUser } from "@/lib/session";
import { getSupportAttachment } from "@/lib/support-inbox";

// Brugerens eget skærmbillede i en supportsag (docs/DECISIONS.md 2026-09-26).
// Kun ejeren kan hente det; admin bruger /api/admin/support/attachments/[id].
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const attachment = await getSupportAttachment(id, user.id);
  if (!attachment) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

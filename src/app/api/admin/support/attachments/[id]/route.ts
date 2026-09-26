import { requireAdminUser } from "@/lib/require-admin";
import { getSupportAttachment } from "@/lib/support-inbox";

// Skærmbillede fra en bruger i Support-indbakken (docs/DECISIONS.md 2026-09-26).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const attachment = await getSupportAttachment(id);
  if (!attachment) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import { stripImageMetadata } from "@/lib/image-metadata";

// Skærmbilleder til Support (docs/DECISIONS.md 2026-09-26). Klienten skalerer
// og komprimerer til JPEG før afsendelse; serveren tjekker type ud fra
// filens første bytes (ikke den oplyste MIME-type), størrelse og antal, og
// fjerner EXIF/GPS (docs/PRIVACY.md) før billedet gemmes i databasen.

export const SUPPORT_ATTACHMENTS_MAX = 3;
export const SUPPORT_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;

export type SupportAttachmentInput = { mimeType: string; data: Buffer };

function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

// Returnerer null ved ugyldige billeder (for mange, for store, forkert type).
export function parseSupportAttachments(value: unknown): SupportAttachmentInput[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > SUPPORT_ATTACHMENTS_MAX) return null;

  const out: SupportAttachmentInput[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const match = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/i.exec(item.trim());
    if (!match) return null;
    const raw = Buffer.from(match[1], "base64");
    if (raw.length === 0 || raw.length > SUPPORT_ATTACHMENT_MAX_BYTES) return null;
    const mimeType = sniffImageType(raw);
    if (!mimeType) return null;
    try {
      out.push({ mimeType, data: stripImageMetadata(raw, mimeType) });
    } catch {
      return null;
    }
  }
  return out;
}

export function supportAttachmentCreateData(attachments: SupportAttachmentInput[]) {
  return attachments.map((attachment) => ({
    mimeType: attachment.mimeType,
    sizeBytes: attachment.data.length,
    data: new Uint8Array(attachment.data),
  }));
}

// Fjerner metadata fra billeder, før de sendes til OpenAI eller gemmes
// (docs/PRIVACY.md "AI"). EXIF kan indeholde GPS-position, telefonmodel,
// serienummer og tidspunkt, så det må aldrig forlade Hello Cal.
//
// Billedet genkodes ikke. Kun metadata-blokke skæres væk, så pixeldata er
// uændrede:
// - JPEG: APP1–APP15 (EXIF, XMP, IPTC, ICC m.fl.) og COM fjernes. APP0 (JFIF)
//   beholdes, fordi den kun beskriver pixelformatet.
// - PNG: tEXt, zTXt, iTXt, eXIf og tIME fjernes.
// - WebP: EXIF- og XMP-chunks fjernes, og VP8X-flagene nulstilles.
// Ukendte eller ødelagte formater afvises i stedet for at blive sendt videre.

export class ImageMetadataError extends Error {}

const DATA_URL_RE = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

export function stripImageMetadataFromDataUrl(dataUrl: string): string {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) throw new ImageMetadataError("Billedet skal være PNG, JPEG eller WebP");
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const input = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  const output = stripImageMetadata(input, mime);
  return `data:${mime};base64,${output.toString("base64")}`;
}

export function stripImageMetadata(input: Buffer, mime: string): Buffer {
  if (mime === "image/jpeg") return stripJpeg(input);
  if (mime === "image/png") return stripPng(input);
  if (mime === "image/webp") return stripWebp(input);
  throw new ImageMetadataError(`Ukendt billedformat: ${mime}`);
}

function stripJpeg(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new ImageMetadataError("Ugyldig JPEG");
  }
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let pos = 2;
  while (pos < buf.length) {
    if (buf[pos] !== 0xff) throw new ImageMetadataError("Ugyldig JPEG-segment");
    const marker = buf[pos + 1];
    // Fyld-bytes (0xFF 0xFF) er tilladt mellem segmenter.
    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    // Start of scan: resten er komprimerede billeddata og slutmarkør.
    if (marker === 0xda) {
      parts.push(buf.subarray(pos));
      return Buffer.concat(parts);
    }
    // Markører uden længdefelt.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buf.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    if (marker === 0xd9) {
      parts.push(buf.subarray(pos, pos + 2));
      return Buffer.concat(parts);
    }
    if (pos + 4 > buf.length) throw new ImageMetadataError("Afkortet JPEG");
    const length = buf.readUInt16BE(pos + 2);
    const end = pos + 2 + length;
    if (length < 2 || end > buf.length) throw new ImageMetadataError("Afkortet JPEG");
    const isAppN = marker >= 0xe1 && marker <= 0xef;
    const isComment = marker === 0xfe;
    if (!isAppN && !isComment) parts.push(buf.subarray(pos, end));
    pos = end;
  }
  throw new ImageMetadataError("JPEG mangler billeddata");
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

function stripPng(buf: Buffer): Buffer {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new ImageMetadataError("Ugyldig PNG");
  }
  const parts: Buffer[] = [PNG_SIGNATURE];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const end = pos + 12 + length;
    if (end > buf.length) throw new ImageMetadataError("Afkortet PNG");
    if (!PNG_DROP.has(type)) parts.push(buf.subarray(pos, end));
    pos = end;
    if (type === "IEND") return Buffer.concat(parts);
  }
  throw new ImageMetadataError("PNG mangler IEND");
}

function stripWebp(buf: Buffer): Buffer {
  if (
    buf.length < 12 ||
    buf.toString("latin1", 0, 4) !== "RIFF" ||
    buf.toString("latin1", 8, 12) !== "WEBP"
  ) {
    throw new ImageMetadataError("Ugyldig WebP");
  }
  const chunks: Buffer[] = [];
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const type = buf.toString("latin1", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const end = pos + 8 + size + (size % 2);
    if (pos + 8 + size > buf.length) throw new ImageMetadataError("Afkortet WebP");
    const chunk = Buffer.from(buf.subarray(pos, Math.min(end, buf.length)));
    if (type === "VP8X") {
      // Flag-byte: bit 3 = EXIF, bit 2 = XMP.
      chunk[8] = chunk[8] & ~(0x08 | 0x04);
    }
    if (type !== "EXIF" && type !== "XMP ") chunks.push(chunk);
    pos = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}

// Samlet indgang for alt, der sendes til en ekstern AI. https-URL'er peger
// på Hello Cals egne, allerede rensede produktbilleder og sendes uændret.
export function sanitizeAiPhoto(photo: string): string {
  if (photo.startsWith("https://")) return photo;
  return stripImageMetadataFromDataUrl(photo);
}

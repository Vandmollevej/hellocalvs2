// Værn mod et beskåret/halveret forsidefoto (bruger 2026-10-15: "halveret …
// Det må ikke ske"). Kameraets forsidefoto er søgerens kvadrat (1:1); et
// telefon-/webkamerabillede er under alle omstændigheder højst 9:16 (0,56). Er det smallere end
// MIN_SIDE_RATIO eller for lille, er det beskåret undervejs, og serveren
// melder det i admin → Log, uanset hvor fejlen sidder.
export const MIN_SIDE_RATIO = 0.45;
export const MIN_SHORT_SIDE = 240;

export type ImageSize = { width: number; height: number };

// Bredde/højde fra JPEG- eller PNG-bytes uden billedbibliotek; null ved andre formater.
export function imageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    // SOF0–SOF15 undtagen DHT (C4), JPG (C8) og DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
}

// Grunden til, at forsidefotoet ser beskåret ud, eller null når det er i orden.
export function frontPhotoProblem(size: ImageSize | null): string | null {
  if (!size || !size.width || !size.height) return null;
  const short = Math.min(size.width, size.height);
  const ratio = short / Math.max(size.width, size.height);
  if (ratio < MIN_SIDE_RATIO) return `unormalt smalt (${size.width}×${size.height}) — sandsynligvis beskåret`;
  if (short < MIN_SHORT_SIDE) return `for lille (${size.width}×${size.height})`;
  return null;
}

export function frontPhotoDataUrlProblem(dataUrl: string): string | null {
  const match = /^data:image\/[a-z]+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  return frontPhotoProblem(imageSize(Buffer.from(match[1].slice(0, 120_000), "base64")));
}

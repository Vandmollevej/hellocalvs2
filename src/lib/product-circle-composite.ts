import { CIRCLE_COLOR, CIRCLE_DIAMETER, circleLayout } from "@/lib/product-circle-layout";

// Server only (sharp). Layout-reglerne står i product-circle-layout.ts.
export async function renderCircleComposite(source: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const meta = await sharp(source).metadata();
  const layout = circleLayout(meta.width ?? 1, meta.height ?? 1);
  const item = await sharp(source)
    .resize(layout.item.width, layout.item.height, { fit: "fill" })
    .ensureAlpha()
    .toBuffer();
  const d = CIRCLE_DIAMETER;
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="${CIRCLE_COLOR}"/></svg>`,
  );
  return sharp({
    create: { width: layout.width, height: layout.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: circle, left: layout.circle.left, top: layout.circle.top },
      { input: item, left: layout.item.left, top: layout.item.top },
    ])
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
}

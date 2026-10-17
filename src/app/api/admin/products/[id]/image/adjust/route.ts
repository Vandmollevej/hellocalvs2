import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Enkle værktøjer på et billedforslag (docs/DECISIONS.md 2026-10-17):
// "for lyst" / "for mørkt" ændrer lysstyrken lidt, "kant ind" æder alfakanten
// én pixel, så rester af hvid baggrund forsvinder. Resultatet bliver et nyt
// forslag (pendingImageUrl); originalfilen røres ikke.
const PRODUCT_IMAGES_DIR = path.join(process.cwd(), "public", "product-images");
const CUTOUT_DIR = path.join(PRODUCT_IMAGES_DIR, "cutouts");
const CUTOUT_URL = /^\/product-images\/cutouts\/[0-9A-Za-z_-]+\.png$/;

const ACTIONS = ["too-bright", "too-dark", "edge-in"] as const;
type Action = (typeof ACTIONS)[number];

async function adjust(input: Buffer, action: Action): Promise<Buffer> {
  if (action === "too-bright") return sharp(input).ensureAlpha().modulate({ brightness: 0.88 }).png().toBuffer();
  if (action === "too-dark") return sharp(input).ensureAlpha().modulate({ brightness: 1.14 }).png().toBuffer();

  const { width, height } = await sharp(input).metadata();
  if (!width || !height) throw new Error("Ukendt billedstørrelse");
  const rgb = await sharp(input).removeAlpha().raw().toBuffer();
  const alpha = await sharp(input)
    .ensureAlpha()
    .extractChannel(3)
    .blur(0.9)
    .threshold(235)
    .blur(0.5)
    .raw()
    .toBuffer();
  return sharp(rgb, { raw: { width, height, channels: 3 } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = ACTIONS.find((candidate) => candidate === body?.action);
  if (!action) return NextResponse.json({ message: "Ukendt værktøj" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id }, select: { pendingImageUrl: true } });
  const url = product?.pendingImageUrl;
  if (!url || !CUTOUT_URL.test(url)) {
    return NextResponse.json({ message: "Forslaget kan ikke justeres" }, { status: 400 });
  }

  const source = await readFile(path.join(PRODUCT_IMAGES_DIR, url.slice("/product-images/".length))).catch(() => null);
  if (!source) return NextResponse.json({ message: "Billedfilen findes ikke" }, { status: 404 });

  const output = await adjust(source, action);
  await mkdir(CUTOUT_DIR, { recursive: true });
  const filename = `adj-${randomUUID()}.png`;
  await writeFile(path.join(CUTOUT_DIR, filename), output);

  const pendingImageUrl = `/product-images/cutouts/${filename}`;
  await prisma.product.update({ where: { id }, data: { pendingImageUrl, imageStatus: "PENDING" } });
  return NextResponse.json({ pendingImageUrl });
}

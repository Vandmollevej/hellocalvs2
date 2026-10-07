import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { callStructuredVision } from "@/lib/product-ai";
import { rejectProduct } from "@/lib/product-approval";
import { recordPetFoodAttempt } from "@/lib/pet-food-strikes";
import { isBlacklistedPetFoodBarcode, petFoodBlockReason } from "@/lib/pet-food-blacklist";
import { debugLog, errorText } from "@/lib/debug-log";

// Natligt job "pet-food-scan" (docs/DECISIONS.md 2026-10-07): dyrefoder-
// spærringens billedtjek. Brugerens regel: billedgenkendelse kører kun om
// natten som robot, aldrig i scan-flowet. Stregkode- og ordspærringen
// (src/lib/pet-food-blacklist.ts) kører stadig live, fordi de er gratis.
//
// Pr. vare: OpenAI ser forsidefotoet (helst originalfotoet fra kamera-flowet,
// ellers varens billede) og svarer, om emballagen er dyrefoder. Er den det med
// sikkerhed, afvises varen (rejectProduct → ejeren får besked, varen bliver
// privat hos ejeren). Alle andre markeres som tjekket. Fejl markeres ikke
// (prøves igen næste nat). Højst MAX_PER_RUN varer pr. kørsel for at
// begrænse AI-udgiften; brugeroprettede og ventende varer først.

const MAX_PER_RUN = 150;
const MIN_REJECT_CONFIDENCE = 0.75;
// Kun et meget sikkert billedsvar tæller som forsøg mod brugeren (advarsel/spærring);
// et mere usikkert svar afviser kun varen.
const MIN_STRIKE_CONFIDENCE = 0.9;
// Eksisterende varer gennemgås med stregkode- og ordspærringen (ingen AI, flag-only).
const MAX_TEXT_SCREEN_PER_RUN = 3000;
const MIME_BY_EXT: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const PET_FOOD_SCHEMA = {
  type: "object",
  properties: {
    isPetFood: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: ["string", "null"] },
  },
  required: ["isPetFood", "confidence", "reason"],
  additionalProperties: false,
};

const PET_FOOD_SYSTEM = [
  "Du ser ét billede af en vareemballage for Hello Cal. Hello Cal er kun til mad og drikke til mennesker.",
  "isPetFood = true KUN hvis emballagen tydeligt er foder, godbidder, tyggeben eller kosttilskud til DYR (hunde, katte, fugle, gnavere, fisk, heste, krybdyr m.fl.).",
  "Typiske tegn: dyr på pakken sammen med tekster som til hunde/katte, dog/cat food, Adult/Puppy/Kitten, fuldfoder, analytiske bestanddele, eller kendte dyrefodermærker.",
  "Mad og drikke til mennesker er ALTID false, også når der er et dyr på pakken eller et dyrenavn i produktnavnet (fx lakridskatte, bjørnebamser, hotdogs).",
  "Er du i tvivl, så isPetFood = false. confidence = 0-1, hvor sikker du er på dit svar. reason = kort begrundelse på dansk (højst 100 tegn), null hvis false.",
].join(" ");

async function loadPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  if (!url.startsWith("/")) return null;
  const root = path.join(process.cwd(), "public");
  const file = path.join(root, path.normalize(url).replace(/^([/\\])+/, ""));
  if (!file.startsWith(root)) return null;
  const mime = MIME_BY_EXT[path.extname(file).toLowerCase()];
  if (!mime) return null;
  const buffer = await readFile(file).catch(() => null);
  return buffer ? `data:${mime};base64,${buffer.toString("base64")}` : null;
}

// Fase 1: gennemgå eksisterende varer (også dem fra før spærringen) med stregkode- og ordspærringen.
// Fund ændrer ikke varen — de vises i admin-oversigten, hvor admin afviser varen eller frikender den.
async function screenExistingProducts(): Promise<{ screened: number; flagged: number }> {
  const products = await prisma.product.findMany({
    where: { petFoodTextCheckedAt: null, status: { not: "REJECTED" }, privateOwnerId: null },
    orderBy: { createdAt: "desc" },
    take: MAX_TEXT_SCREEN_PER_RUN,
    select: {
      id: true,
      name: true,
      subbrand: true,
      variant: true,
      ingredientsText: true,
      brand: { select: { name: true } },
      barcodes: { select: { code: true } },
    },
  });
  let flagged = 0;
  for (const product of products) {
    const barcodeHit = product.barcodes.map((b) => b.code).find((code) => isBlacklistedPetFoodBarcode(code));
    const verdict = barcodeHit
      ? { reason: "barcode", match: barcodeHit }
      : petFoodBlockReason({
          texts: [product.name, product.brand?.name, product.subbrand, product.variant, product.ingredientsText],
        });
    if (!verdict) continue;
    flagged += 1;
    await recordPetFoodAttempt({
      source: "SCREEN",
      kind: "FLAGGED_EXISTING",
      productId: product.id,
      productName: product.name,
      barcode: barcodeHit ?? product.barcodes[0]?.code,
      matchedBy: `${verdict.reason}: ${verdict.match}`,
      countAsStrike: false,
    });
  }
  if (products.length) {
    await prisma.product.updateMany({
      where: { id: { in: products.map((p) => p.id) } },
      data: { petFoodTextCheckedAt: new Date() },
    });
  }
  return { screened: products.length, flagged };
}

export async function scanProductsForPetFood(): Promise<string> {
  const screen = await screenExistingProducts();
  const products = await prisma.product.findMany({
    where: {
      petFoodCheckedAt: null,
      status: { not: "REJECTED" },
      privateOwnerId: null,
      OR: [{ createdByUserId: { not: null } }, { status: "PENDING" }],
      AND: [
        {
          OR: [
            { imageUrl: { not: null } },
            { pendingImageUrl: { not: null } },
            { aiAnalyses: { some: { kind: "FRONT", imageUrl: { not: null } } } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_RUN,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      pendingImageUrl: true,
      createdByUserId: true,
      brand: { select: { name: true } },
      barcodes: { select: { code: true }, take: 1 },
      aiAnalyses: { where: { kind: "FRONT", imageUrl: { not: null } }, orderBy: { createdAt: "desc" }, take: 1, select: { imageUrl: true } },
    },
  });

  let checked = 0;
  let rejected = 0;
  let skipped = 0;
  let failed = 0;
  for (const product of products) {
    const startedAt = Date.now();
    // Originalfotoet fra kamera-flowet er bedst; ellers varens billede.
    const sourceUrl = product.aiAnalyses[0]?.imageUrl ?? product.imageUrl ?? product.pendingImageUrl;
    const photo = await loadPhoto(sourceUrl);
    if (!photo) {
      // Intet læsbart foto: markér som tjekket, så varen ikke blokerer køen hver nat.
      await prisma.product.update({ where: { id: product.id }, data: { petFoodCheckedAt: new Date() } });
      skipped += 1;
      continue;
    }
    try {
      const { value } = await callStructuredVision<{ isPetFood: boolean; confidence: number; reason: string | null }>({
        photo,
        schemaName: "hello_cal_pet_food_check",
        schema: PET_FOOD_SCHEMA,
        system: PET_FOOD_SYSTEM,
        text: [`Varenavn: ${product.name}`, product.brand?.name ? `Mærke: ${product.brand.name}` : ""].filter(Boolean).join("\n"),
      });
      if (value.isPetFood && value.confidence >= MIN_REJECT_CONFIDENCE) {
        await rejectProduct(product.id);
        rejected += 1;
        // Hver afvisning vises i admin-oversigten; kun et meget sikkert svar tæller som forsøg mod brugeren.
        await recordPetFoodAttempt({
          userId: product.createdByUserId,
          source: "NIGHT",
          kind: "AUTO_REJECTED",
          productId: product.id,
          productName: product.name,
          barcode: product.barcodes[0]?.code,
          matchedBy: value.reason ?? "dyrefoder på billedet",
          countAsStrike: value.confidence >= MIN_STRIKE_CONFIDENCE,
        });
        await debugLog({
          category: "scan",
          event: "pet_food_rejected",
          level: "warn",
          message: `Varen afvist om natten: dyrefoder på billedet (${Math.round(value.confidence * 100)} %) — ${product.name}${value.reason ? ` · ${value.reason}` : ""}`,
          productId: product.id,
          barcode: product.barcodes[0]?.code,
          durationMs: Date.now() - startedAt,
        });
      }
      await prisma.product.update({ where: { id: product.id }, data: { petFoodCheckedAt: new Date() } });
      checked += 1;
    } catch (error) {
      failed += 1;
      console.error(`[pet-food-scan] ${product.id} fejlede`, error);
      await debugLog({
        category: "scan",
        event: "pet_food_scan",
        level: "error",
        message: `Dyrefoder-billedtjek fejlede: ${errorText(error)}`,
        productId: product.id,
        durationMs: Date.now() - startedAt,
      });
    }
  }
  return `Eksisterende varer: ${screen.screened} gennemgået, ${screen.flagged} markeret · billedtjek: ${products.length} varer i kø, ${checked} tjekket, ${rejected} afvist som dyrefoder, ${skipped} uden foto, ${failed} fejl`;
}

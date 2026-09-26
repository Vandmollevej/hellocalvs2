import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { callStructuredVision } from "@/lib/product-ai";
import { shelfPhotoPath } from "@/lib/scan/storage";

// Hyldegenkendelse (docs/OPRETTELSES-APP.md "C"): OpenAI Vision finder de
// synlige produkter med afgrænsningsboks + navn/brand/logo-tekst. Stregkoder
// kan ikke ses på et hyldebillede, så matchet mod databasen sker på
// navn/logo: først en tekstsøgning efter kandidater, derefter vurderer AI'en
// med billedet foran sig, hvilken kandidat (om nogen) der er samme vare.

export const EXISTS_THRESHOLD = 0.8;
export const UNCERTAIN_THRESHOLD = 0.5;

type DetectedItem = {
  name: string;
  brand: string | null;
  visibleText: string | null;
  box: { x: number; y: number; w: number; h: number };
};

const DETECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "brand", "visibleText", "box"],
        properties: {
          name: { type: "string" },
          brand: { type: ["string", "null"] },
          visibleText: { type: ["string", "null"] },
          box: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "w", "h"],
            properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
          },
        },
      },
    },
  },
};

const MATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["itemIndex", "productId", "confidence"],
        properties: {
          itemIndex: { type: "integer" },
          productId: { type: ["string", "null"] },
          confidence: { type: "number" },
        },
      },
    },
  },
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

type Candidate = { id: string; label: string };

async function findCandidates(item: DetectedItem): Promise<Candidate[]> {
  const words = [...new Set(tokens(`${item.brand ?? ""} ${item.name}`))].slice(0, 6);
  if (!words.length) return [];
  const rows = await prisma.product.findMany({
    where: {
      status: { not: "REJECTED" },
      OR: words.flatMap((word) => [
        { name: { contains: word, mode: "insensitive" as const } },
        { brand: { name: { contains: word, mode: "insensitive" as const } } },
        { subbrand: { contains: word, mode: "insensitive" as const } },
      ]),
    },
    select: { id: true, name: true, subbrand: true, variant: true, packageSizeText: true, brand: { select: { name: true } } },
    take: 60,
  });
  const wanted = new Set(words);
  return rows
    .map((row) => {
      const label = [row.brand?.name, row.subbrand, row.name, row.variant, row.packageSizeText].filter(Boolean).join(" ");
      const overlap = tokens(label).filter((token) => wanted.has(token)).length;
      return { id: row.id, label, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 6)
    .map(({ id, label }) => ({ id, label }));
}

export function statusForConfidence(productId: string | null, confidence: number) {
  if (!productId) return "MISSING" as const;
  if (confidence >= EXISTS_THRESHOLD) return "EXISTS" as const;
  if (confidence >= UNCERTAIN_THRESHOLD) return "UNCERTAIN" as const;
  return "MISSING" as const;
}

export async function analyzeShelfPhoto(shelfPhotoId: string) {
  const photo = await prisma.shelfPhoto.findUnique({ where: { id: shelfPhotoId } });
  if (!photo) return;

  try {
    const buffer = await readFile(shelfPhotoPath(photo.imageUrl));
    const mime = photo.imageUrl.endsWith(".png") ? "image/png" : photo.imageUrl.endsWith(".webp") ? "image/webp" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

    const detection = await callStructuredVision<{ items: DetectedItem[] }>({
      photo: dataUrl,
      schemaName: "shelf_products",
      schema: DETECT_SCHEMA,
      system:
        "Du analyserer et foto af en butikshylde. Find hvert synligt, forskelligt emballeret produkt (én post pr. produkt-facing-gruppe, ikke pr. enkelt pakke hvis flere ens står side om side). Svar kun med det der faktisk kan ses.",
      text:
        "List produkterne. name = varens navn/type som skrevet på emballagen, brand = mærke/logo-tekst (null hvis ukendt), visibleText = øvrig læsbar tekst (smag, størrelse), box = afgrænsningsboks normaliseret 0..1 (x,y = øverste venstre hjørne, w,h = bredde/højde) i forhold til hele billedet.",
    });

    const items = detection.value.items.slice(0, 40);
    const candidatesByItem = await Promise.all(items.map(findCandidates));

    const matches = new Map<number, { productId: string | null; confidence: number }>();
    if (candidatesByItem.some((list) => list.length)) {
      const listing = items
        .map((item, index) => {
          const candidates = candidatesByItem[index];
          const lines = candidates.length ? candidates.map((c) => `   - ${c.id}: ${c.label}`).join("\n") : "   (ingen kandidater)";
          return `${index}. ${[item.brand, item.name, item.visibleText].filter(Boolean).join(" | ")}\n${lines}`;
        })
        .join("\n");
      const matched = await callStructuredVision<{ matches: { itemIndex: number; productId: string | null; confidence: number }[] }>({
        photo: dataUrl,
        schemaName: "shelf_matches",
        schema: MATCH_SCHEMA,
        system:
          "Du afgør om produkter på et hyldefoto allerede findes i en produktdatabase. Sammenlign navn, mærke/logo, smag/variant og størrelse. Vælg kun en kandidat, hvis det er samme vare (samme variant). confidence er 0..1.",
        text: `Produkter fundet på billedet og deres databasekandidater:\n${listing}\n\nGiv ét svar pr. produkt (itemIndex). productId = kandidatens id eller null.`,
      });
      for (const match of matched.value.matches) {
        const allowed = candidatesByItem[match.itemIndex]?.some((c) => c.id === match.productId);
        matches.set(match.itemIndex, {
          productId: allowed ? match.productId : null,
          confidence: clamp01(match.confidence),
        });
      }
    }

    await prisma.$transaction([
      prisma.shelfPhotoItem.deleteMany({ where: { shelfPhotoId, manuallyAssigned: false } }),
      prisma.shelfPhotoItem.createMany({
        data: items.map((item, index) => {
          const match = matches.get(index) ?? { productId: null, confidence: 0 };
          return {
            shelfPhotoId,
            x: clamp01(item.box.x),
            y: clamp01(item.box.y),
            w: clamp01(item.box.w),
            h: clamp01(item.box.h),
            detectedName: item.name.slice(0, 200),
            detectedBrand: item.brand?.slice(0, 120) ?? null,
            detectedText: item.visibleText?.slice(0, 300) ?? null,
            productId: match.productId,
            matchConfidence: match.productId ? match.confidence : null,
            status: statusForConfidence(match.productId, match.confidence),
          };
        }),
      }),
      prisma.shelfPhoto.update({ where: { id: shelfPhotoId }, data: { analysisStatus: "DONE", analysisError: null } }),
    ]);
  } catch (error) {
    await prisma.shelfPhoto.update({
      where: { id: shelfPhotoId },
      data: { analysisStatus: "FAILED", analysisError: error instanceof Error ? error.message.slice(0, 500) : "Ukendt fejl" },
    });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { callStructuredVision, getProductVisionModel } from "@/lib/product-ai";
import { textSimilarity } from "@/lib/product-search-ranking";
import type {
  CameraDetectedItem,
  CameraDetection,
  CameraDetectionResponse,
  DetectionShape,
} from "@/lib/camera-detection-types";

// POST /api/ai/detect-camera-objects — { photo: string (square data URL), includeHelloFresh?: boolean }
//
// Backend for the automatic "Produkt" camera tab (docs/DECISIONS.md
// 2026-09-25 "Automatisk produktgenkendelse i kameraet"). The camera page
// sends a still frame on its own once the camera is held steady; AI vision
// finds the food-relevant things in it, says whether each is a round plate
// (drawn as a ring) or another object (drawn as its contour), and lists the
// foods. Each food is matched against our own product database; only
// without a local match is the AI's own nutrition estimate used, marked as
// such. Never writes anything — the client registers via /api/registrations.

const MAX_DETECTIONS = 6;
const MATCH_THRESHOLD = 0.6;

const FOOD_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Dansk navn på fødevaren/produktet, uden mærke" },
    brand: { type: ["string", "null"], description: "Mærke, hvis det kan læses på emballagen" },
    grams: { type: "number", description: "Estimeret spist mængde i gram: på tallerken det synlige; for emballerede produkter en typisk portion, ikke hele pakken" },
    kcalPer100g: { type: "number" },
    proteinPer100g: { type: "number" },
    carbsPer100g: { type: "number" },
    fatPer100g: { type: "number" },
  },
  required: ["name", "brand", "grams", "kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"],
  additionalProperties: false,
};

const DETECTION_SCHEMA = {
  type: "object",
  properties: {
    detections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Kort dansk betegnelse for objektet" },
          kind: { type: "string", enum: ["plate", "object"] },
          ellipse: {
            type: "object",
            description: "Plate: ellipsen langs tallerkenens/skålens kant. Object: omsluttende ellipse.",
            properties: {
              cx: { type: "number" },
              cy: { type: "number" },
              rx: { type: "number" },
              ry: { type: "number" },
            },
            required: ["cx", "cy", "rx", "ry"],
            additionalProperties: false,
          },
          outline: {
            type: "array",
            description: "Object: 8-20 punkter [x, y] langs objektets kontur, i rækkefølge. Plate: tom liste.",
            items: { type: "array", items: { type: "number" } },
          },
          foods: { type: "array", items: FOOD_SCHEMA },
        },
        required: ["label", "kind", "ellipse", "outline", "foods"],
        additionalProperties: false,
      },
    },
  },
  required: ["detections"],
  additionalProperties: false,
};

type RawFood = {
  name: string;
  brand: string | null;
  grams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

type RawDetection = {
  label: string;
  kind: "plate" | "object";
  ellipse: { cx: number; cy: number; rx: number; ry: number };
  outline: number[][];
  foods: RawFood[];
};

const SYSTEM_PROMPT =
  "Du ser et kvadratisk foto fra en kalorie-app's kamera. Find de ting på billedet, som brugeren kan ville registrere som mad eller drikke: " +
  "tallerkener/skåle med mad, emballerede produkter, frugt, drikkevarer osv. Ignorér baggrund, hænder, bestik og ting der ikke er mad. " +
  "Alle koordinater er brøkdele 0-1 af billedets bredde (x) og højde (y), med (0,0) øverst til venstre. " +
  "kind='plate' kun for en rund tallerken eller skål: angiv ellipsen præcist langs kanten og lad outline være tom; foods er hver ret/ingrediens på tallerkenen med estimeret gram. " +
  "kind='object' for alt andet: outline er 8-20 punkter der følger objektets synlige kontur tæt; foods er normalt ét element (selve produktet). " +
  `Højst ${MAX_DETECTIONS} objekter. Er der intet mad på billedet, returnér detections=[]. Næringsværdier er dit bedste estimat pr. 100 g.`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function toShape(raw: RawDetection): DetectionShape | null {
  const outline = (raw.outline ?? [])
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [clamp01(point[0]), clamp01(point[1])] as [number, number]);
  if (raw.kind === "object" && outline.length >= 3) return { type: "polygon", points: outline };

  const { cx, cy, rx, ry } = raw.ellipse;
  const shape = { type: "ellipse" as const, cx: clamp01(cx), cy: clamp01(cy), rx: clamp01(rx), ry: clamp01(ry) };
  return shape.rx > 0.01 && shape.ry > 0.01 ? shape : null;
}

// HelloFresh dishes may only be suggested inside Opret ret (docs/DECISIONS.md
// 2026-09-24 "HelloFresh kun i Opret ret"), i.e. when the camera was opened
// with `for=ret`.
async function findLocalMatch(food: RawFood, includeHelloFresh: boolean) {
  const query = [food.brand, food.name].filter(Boolean).join(" ").trim();
  const words = food.name.trim().split(/\s+/).filter((word) => word.length >= 3).slice(0, 3);
  if (words.length === 0) return null;

  const candidates = await prisma.product.findMany({
    where: {
      discontinued: false,
      status: "APPROVED",
      AND: includeHelloFresh
        ? []
        : [{ OR: [{ externalSource: null }, { externalSource: { not: "HELLOFRESH" as const } }] }],
      OR: [
        ...words.map((word) => ({ name: { contains: word, mode: "insensitive" as const } })),
        ...(food.brand ? [{ brand: { name: { contains: food.brand, mode: "insensitive" as const } } }] : []),
      ],
    },
    include: { brand: { select: { name: true } } },
    take: 40,
  });

  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = Math.max(
      textSimilarity(food.name, candidate.name, candidate.brand?.name),
      textSimilarity(query, candidate.name, candidate.brand?.name)
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

async function toItem(food: RawFood, id: string, includeHelloFresh: boolean): Promise<CameraDetectedItem> {
  const grams = Math.max(0, Math.round(food.grams));
  const factor = grams / 100;
  const match = await findLocalMatch(food, includeHelloFresh);
  const per100 = match
    ? { kcal: match.kcalPer100g, protein: match.proteinPer100g, carbs: match.carbsPer100g, fat: match.fatPer100g }
    : { kcal: food.kcalPer100g, protein: food.proteinPer100g, carbs: food.carbsPer100g, fat: food.fatPer100g };

  return {
    id,
    title: match ? match.name : food.name,
    amountGrams: grams,
    amountLabel: `${grams} g`,
    kcal: Math.round(per100.kcal * factor),
    protein: Math.round(per100.protein * factor),
    carbs: Math.round(per100.carbs * factor),
    fat: Math.round(per100.fat * factor),
    productId: match?.id ?? null,
    image: match?.imageUrl ?? null,
    estimated: !match,
  };
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const includeHelloFresh = body?.includeHelloFresh === true;
  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo (data URL) er påkrævet" }, { status: 400 });
  }

  try {
    const { value } = await callStructuredVision<{ detections: RawDetection[] }>({
      photo,
      system: SYSTEM_PROMPT,
      text: "Find og omrids maden på billedet.",
      schemaName: "camera_detections",
      schema: DETECTION_SCHEMA,
      model: process.env.OPENAI_CAMERA_VISION_MODEL?.trim() || getProductVisionModel(),
    });

    const detections: CameraDetection[] = [];
    for (const [index, raw] of value.detections.slice(0, MAX_DETECTIONS).entries()) {
      const shape = toShape(raw);
      if (!shape) continue;
      const items = await Promise.all(
        raw.foods.map((food, foodIndex) => toItem(food, `${index}-${foodIndex}`, includeHelloFresh))
      );
      detections.push({ id: `${index}`, label: raw.label, kind: raw.kind, shape, items });
    }

    return NextResponse.json({ detections } satisfies CameraDetectionResponse);
  } catch (error) {
    console.error("Camera object detection failed", error);
    return NextResponse.json({ detections: [], message: "Genkendelse slog fejl" }, { status: 503 });
  }
}

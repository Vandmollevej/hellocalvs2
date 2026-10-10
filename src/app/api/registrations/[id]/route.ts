import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productImageForViewer } from "@/lib/product-display-image";
import { unauthorized } from "@/lib/session";
import { getProfileContext, getProfileUser, mayDeleteRegistration } from "@/lib/family-access";
import { detectNutritionChanges, USER_EDIT_CONFIDENCE } from "@/lib/nutrition-reports";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = await getProfileUser("registrations", "VIEWED");

    if (!user) return unauthorized();
    const registration = await prisma.registration.findFirst({
      where: { id, userId: user.id },
      include: {
        product: {
          select: {
            imageUrl: true,
            pendingImageUrl: true,
            createdByUserId: true,
            servingSizeGrams: true,
            servingSizeUnitSingular: true,
            servingSizeUnitPlural: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ registration: null }, { status: 404 });
    }

    const { product, ...rest } = registration;
    return NextResponse.json({
      registration: {
        ...rest,
        product: product
          ? {
              imageUrl: productImageForViewer(product, user.id),
              servingSizeGrams: product.servingSizeGrams,
              servingSizeUnitSingular: product.servingSizeUnitSingular,
              servingSizeUnitPlural: product.servingSizeUnitPlural,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Registration fetch failed", error);
    return NextResponse.json(
      { registration: null, message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function scaleJsonRecord(value: unknown, scale: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const scaled: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "number") scaled[key] = entry * scale;
  }
  return scaled;
}

function scaleOptional(value: number | null, scale: number) {
  return value === null ? null : value * scale;
}

// PATCH /api/registrations/[id] — two uses:
// - { createdAt } alone: moves a registration to a new time. Used by the
//   calendar's press-and-drag gesture (DraggableEntryMarker).
// - { amountGrams, kcal/protein/carbs/fatSnapshot, createdAt? }: the user
//   edits a registration they already added (/registration/[id]). The new
//   macro values come from the client (based on the registration's own
//   snapshot, never the current product), and every optional extra-nutrition
//   snapshot is scaled proportionally to the new amount — so snapshot
//   semantics hold: a later product update still never changes it.
export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json();
  const { createdAt, amountGrams, kcalSnapshot, proteinSnapshot, carbsSnapshot, fatSnapshot } = body as {
    createdAt?: string;
    amountGrams?: number;
    kcalSnapshot?: number;
    proteinSnapshot?: number;
    carbsSnapshot?: number;
    fatSnapshot?: number;
  };

  const editsAmount = amountGrams !== undefined;
  if (!createdAt && !editsAmount) {
    return NextResponse.json({ message: "createdAt eller amountGrams er påkrævet" }, { status: 400 });
  }
  const parsedCreatedAt = createdAt ? new Date(createdAt) : undefined;
  if (parsedCreatedAt && Number.isNaN(parsedCreatedAt.getTime())) {
    return NextResponse.json({ message: "Ugyldig createdAt" }, { status: 400 });
  }
  if (
    editsAmount &&
    (!isFiniteNonNegative(amountGrams) ||
      amountGrams <= 0 ||
      ![kcalSnapshot, proteinSnapshot, carbsSnapshot, fatSnapshot].every(isFiniteNonNegative))
  ) {
    return NextResponse.json(
      { message: "amountGrams (> 0) og alle snapshot-værdier er påkrævet" },
      { status: 400 }
    );
  }

  try {
    const user = await getProfileUser("registrations", "UPDATED");

    if (!user) return unauthorized();

    if (!editsAmount) {
      const result = await prisma.registration.updateMany({
        where: { id, userId: user.id },
        data: { createdAt: parsedCreatedAt },
      });

      if (result.count === 0) {
        return NextResponse.json({ message: "Registreringen findes ikke" }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.registration.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ message: "Registreringen findes ikke" }, { status: 404 });
    }

    const scale = existing.amountGrams > 0 ? (amountGrams as number) / existing.amountGrams : 1;
    // Samme kontrolsag som ved ny registrering (docs/DECISIONS.md 2026-10-10):
    // kun når protein/kulhydrat/fedt faktisk er ændret i forhold til det, der
    // allerede lå i registreringen, så en gentagen gem ikke giver dubletter.
    const macroSnapshotChanged =
      user.role !== "ADMIN" &&
      existing.productId !== null &&
      (
        [
          [proteinSnapshot, existing.proteinSnapshot],
          [carbsSnapshot, existing.carbsSnapshot],
          [fatSnapshot, existing.fatSnapshot],
        ] as [number, number][]
      ).some(([next, before]) => Math.abs(next - before * scale) >= 0.05);
    const product = macroSnapshotChanged
      ? await prisma.product.findUnique({
          where: { id: existing.productId as string },
          select: { proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
        })
      : null;
    const nutritionChanges = product
      ? detectNutritionChanges(product, amountGrams as number, {
          proteinPer100g: proteinSnapshot,
          carbsPer100g: carbsSnapshot,
          fatPer100g: fatSnapshot,
        })
      : [];

    const registration = await prisma.registration.update({
      where: { id: existing.id },
      data: {
        amountGrams: amountGrams as number,
        kcalSnapshot: kcalSnapshot as number,
        proteinSnapshot: proteinSnapshot as number,
        carbsSnapshot: carbsSnapshot as number,
        fatSnapshot: fatSnapshot as number,
        sugarSnapshot: scaleOptional(existing.sugarSnapshot, scale),
        fiberSnapshot: scaleOptional(existing.fiberSnapshot, scale),
        saltSnapshot: scaleOptional(existing.saltSnapshot, scale),
        potassiumSnapshot: scaleOptional(existing.potassiumSnapshot, scale),
        calciumSnapshot: scaleOptional(existing.calciumSnapshot, scale),
        ironSnapshot: scaleOptional(existing.ironSnapshot, scale),
        saturatedFatSnapshot: scaleOptional(existing.saturatedFatSnapshot, scale),
        unsaturatedFatSnapshot: scaleOptional(existing.unsaturatedFatSnapshot, scale),
        transFatSnapshot: scaleOptional(existing.transFatSnapshot, scale),
        cholesterolSnapshot: scaleOptional(existing.cholesterolSnapshot, scale),
        vitaminASnapshot: scaleOptional(existing.vitaminASnapshot, scale),
        vitaminCSnapshot: scaleOptional(existing.vitaminCSnapshot, scale),
        nutrientSnapshot: scaleJsonRecord(existing.nutrientSnapshot, scale),
        nutrientEstimatedSnapshot: scaleJsonRecord(existing.nutrientEstimatedSnapshot, scale),
        nutrientToleranceSnapshot: scaleJsonRecord(existing.nutrientToleranceSnapshot, scale),
        ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
      },
    });

    if (nutritionChanges.length > 0 && existing.productId) {
      await prisma.productNutritionReport.create({
        data: {
          productId: existing.productId,
          reporterUserId: user.id,
          source: "USER_EDIT",
          amountGrams: amountGrams as number,
          changes: nutritionChanges,
          confidence: USER_EDIT_CONFIDENCE,
        },
      });
    }

    return NextResponse.json({ ok: true, registration });
  } catch (error) {
    console.error("Registration update failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const context = await getProfileContext("registrations", "DELETED");
    if (!context) return unauthorized();
    const user = context.profile;
    const existing = await prisma.registration.findFirst({
      where: { id, userId: user.id },
      select: { createdById: true },
    });
    if (existing && !(await mayDeleteRegistration(context.login.id, user.id, existing.createdById))) {
      return NextResponse.json(
        { message: "Du kan ikke slette en registrering, som en anden har lavet.", code: "deleteNotAllowed" },
        { status: 403 }
      );
    }
    const result = await prisma.registration.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Registreringen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Registration delete failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

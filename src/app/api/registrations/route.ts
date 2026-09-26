import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileContext, getProfileUser, shareRegistration } from "@/lib/family-access";
import { fulfillMatchingForward } from "@/lib/forwards";
import { getUserSubscriptionTier, getRetentionCutoffDate } from "@/lib/subscription";
import { detectNutritionChanges, USER_EDIT_CONFIDENCE } from "@/lib/nutrition-reports";
import { classifyProduct } from "@/lib/food-classification";
import {
  nutrientSnapshotData,
  resolveGenericIngredientNutrients,
  resolveProductNutrients,
} from "@/lib/nutrient-resolution";

export async function GET() {
  try {
    const user = await getProfileUser("registrations", "VIEWED");

    if (!user) return unauthorized();
    // Rullende 30-dages historik for gratisbrugere (docs/DECISIONS.md
    // 2026-09-19) — data ældre end grænsen skjules her ved en ren
    // forespørgselsgrænse, ikke ved at slette eller markere rækkerne, så det
    // med det samme kommer tilbage hvis brugeren bliver Seriøs.
    const cutoff = getRetentionCutoffDate(await getUserSubscriptionTier(user.id));
    const registrations = await prisma.registration.findMany({
      where: { userId: user.id, ...(cutoff ? { createdAt: { gte: cutoff } } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            imageUrl: true,
            servingSizeGrams: true,
            servingSizeUnitSingular: true,
            servingSizeUnitPlural: true,
            productCategory: true,
            productType: true,
            dietaryTags: true,
            nutritionExtra: true,
          },
        },
      },
      // 3000 comfortably covers over half a year of history (~4 registrations/day),
      // so statistics/calendar can show the whole trend instead of just the
      // last ~3-4 months.
      take: 3000,
    });

    // G3-klassifikation (kødtype, alkohol, sukkerholdig drik) beregnes fra
    // produktet; kun de visningsfelter, klienten bruger, sendes med.
    return NextResponse.json({
      registrations: registrations.map(({ product, ...registration }) => ({
        ...registration,
        product: product
          ? {
              imageUrl: product.imageUrl,
              servingSizeGrams: product.servingSizeGrams,
              servingSizeUnitSingular: product.servingSizeUnitSingular,
              servingSizeUnitPlural: product.servingSizeUnitPlural,
            }
          : null,
        classification: product ? classifyProduct(product) : null,
      })),
    });
  } catch (error) {
    console.error("Registration list failed", error);
    return NextResponse.json(
      { registrations: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// POST /api/registrations — manual addition of a registration.
// Calories/macros are saved as a snapshot on the registration itself, per
// docs/DATABASE.md, and are therefore never changed by later product updates.
//
// Three forms:
// - { productId, amountGrams } — normal flow, snapshot is calculated from the product.
// - { dishId, amountGrams } — a custom dish (see /create-dish); snapshot is
//   calculated from the sum of the dish's ingredients, scaled to amountGrams.
// - { titleSnapshot, kcalSnapshot, proteinSnapshot, carbsSnapshot, fatSnapshot,
//   amountGrams } without productId/dishId — used when the voice/AI flow (see
//   /api/ai/interpret-meal) suggests a food item with no match in the database. The
//   item is created here as a new "PENDING" candidate (per docs/ADMIN.md), so it can
//   be recognized/approved going forward instead of guessing every time.
export async function POST(req: Request) {
  const body = await req.json();
  const {
    productId,
    dishId,
    genericIngredientId,
    amountGrams,
    titleSnapshot,
    kcalSnapshot,
    proteinSnapshot,
    carbsSnapshot,
    fatSnapshot,
    createdAt,
    shareWith,
  } = body as {
    productId?: string;
    dishId?: string;
    genericIngredientId?: string;
    amountGrams: number;
    titleSnapshot?: string;
    // With productId/dishId these three are optional overrides of the calculated
    // macros (e.g. adjusted via the Energy distribution sliders in /add), not a
    // requirement for a fully independent snapshot like in the AI flow below.
    kcalSnapshot?: number;
    proteinSnapshot?: number;
    carbsSnapshot?: number;
    fatSnapshot?: number;
    createdAt?: string;
    // Fælles måltid: kopier også til disse profiler med hver deres portion
    // (docs/FAMILY.md).
    shareWith?: unknown;
  };

  if (!amountGrams || amountGrams <= 0) {
    return NextResponse.json(
      { message: "amountGrams (> 0) er påkrævet" },
      { status: 400 }
    );
  }

  const parsedCreatedAt = createdAt ? new Date(createdAt) : undefined;
  if (parsedCreatedAt && Number.isNaN(parsedCreatedAt.getTime())) {
    return NextResponse.json({ message: "createdAt er ugyldig" }, { status: 400 });
  }

  try {
    const context = await getProfileContext("registrations", "CREATED");
    if (!context) return unauthorized();
    const user = context.profile;
    // Hvem der tastede ind, når det ikke er profilens ejer (docs/FAMILY.md).
    const createdById = context.login.id !== user.id ? context.login.id : null;
    const share = async (registration: { id: string; userId: string }) =>
      shareRegistration(registration, shareWith, context.login.id);

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          brand: { select: { name: true } },
          nutritionFeatures: {
            select: {
              sugarsPer100g: true,
              sugarSource: true,
              fiberPer100g: true,
              fiberSource: true,
              saltPer100g: true,
              saltSource: true,
            },
          },
        },
      });
      if (!product) {
        return NextResponse.json({ message: "Produkt ikke fundet" }, { status: 404 });
      }

      const factor = amountGrams / 100;
      // nutritionExtra (sugar/fiber/salt/potassium/calcium/iron) is stored per
      // the product's own servingSizeGrams, NOT per 100g like the core macros
      // (see scripts/hellofresh-import/agent.py, docs/DECISIONS.md 2026-08-29)
      // — only scale it when we actually know that serving size.
      const extraFactor = product.servingSizeGrams ? amountGrams / product.servingSizeGrams : null;
      const extra = (product.nutritionExtra ?? null) as Record<string, number> | null;
      const scaledExtra = (key: string) =>
        extraFactor !== null && extra && typeof extra[key] === "number" ? extra[key] * extraFactor : undefined;

      // Brugerindberetning (docs/DECISIONS.md 2026-09-23): har en ikke-admin
      // ændret protein/kulhydrat/fedt via skyderne, oprettes en kontrolsag til
      // admin Kvalitetskontrol. Afgøres her på serveren ud fra de faktisk
      // indsendte værdier, så klienten ikke kan springe kontrollen over.
      // Produktet selv ændres aldrig her — kun ved admin-godkendelse.
      const nutritionChanges =
        user.role === "ADMIN"
          ? []
          : detectNutritionChanges(product, amountGrams, {
              proteinPer100g: proteinSnapshot,
              carbsPer100g: carbsSnapshot,
              fatPer100g: fatSnapshot,
            });

      // Usikkerheds-~: alle næringsstoffer + estimeret andel som snapshot.
      const nutrients = await resolveProductNutrients(product).catch(() => []);

      // Registrering og kontrolsag i samme transaktion: én rapport pr. gem,
      // aldrig en halv tilstand.
      const registration = await prisma.$transaction(async (tx) => {
        const created = await tx.registration.create({
          data: {
            userId: user.id,
            createdById,
            productId: product.id,
            titleSnapshot: product.name,
            kcalSnapshot: kcalSnapshot ?? product.kcalPer100g * factor,
            proteinSnapshot: proteinSnapshot ?? product.proteinPer100g * factor,
            carbsSnapshot: carbsSnapshot ?? product.carbsPer100g * factor,
            ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
            fatSnapshot: fatSnapshot ?? product.fatPer100g * factor,
            sugarSnapshot: scaledExtra("sugarG"),
            fiberSnapshot: scaledExtra("fiberG"),
            saltSnapshot: scaledExtra("saltG"),
            potassiumSnapshot: scaledExtra("potassiumMg"),
            calciumSnapshot: scaledExtra("calciumMg"),
            ironSnapshot: scaledExtra("ironMg"),
            // MyFitnessPal-style extended panel (2026-09-11): real per-100g
            // Product fields (currently only populated from Open Food Facts),
            // scaled the same way as kcal/protein/carbs/fat above.
            saturatedFatSnapshot: product.saturatedFatPer100g !== null ? product.saturatedFatPer100g * factor : undefined,
            unsaturatedFatSnapshot:
              product.unsaturatedFatPer100g !== null ? product.unsaturatedFatPer100g * factor : undefined,
            transFatSnapshot: product.transFatPer100g !== null ? product.transFatPer100g * factor : undefined,
            cholesterolSnapshot: product.cholesterolPer100g !== null ? product.cholesterolPer100g * factor : undefined,
            vitaminASnapshot: product.vitaminAPer100g !== null ? product.vitaminAPer100g * factor : undefined,
            vitaminCSnapshot: product.vitaminCPer100g !== null ? product.vitaminCPer100g * factor : undefined,
            ...nutrientSnapshotData(nutrients, factor),
            amountGrams,
          },
        });

        if (nutritionChanges.length > 0) {
          await tx.productNutritionReport.create({
            data: {
              productId: product.id,
              reporterUserId: user.id,
              source: "USER_EDIT",
              amountGrams,
              changes: nutritionChanges,
              confidence: USER_EDIT_CONFIDENCE,
            },
          });
        }
        return created;
      });

      await fulfillMatchingForward(user.id, "PRODUCT", product.id);
      return NextResponse.json({ registration, sharedCount: await share(registration) });
    }

    if (genericIngredientId) {
      const ingredient = await prisma.genericIngredient.findUnique({ where: { id: genericIngredientId } });
      if (!ingredient) {
        return NextResponse.json({ message: "Ingrediens ikke fundet" }, { status: 404 });
      }

      const factor = amountGrams / 100;
      const nutrients = await resolveGenericIngredientNutrients(ingredient).catch(() => []);
      const registration = await prisma.registration.create({
        data: {
          userId: user.id,
          createdById,
          genericIngredientId: ingredient.id,
          ...nutrientSnapshotData(nutrients, factor),
          titleSnapshot: ingredient.name,
          kcalSnapshot: kcalSnapshot ?? (ingredient.kcalPer100g ?? 0) * factor,
          proteinSnapshot: proteinSnapshot ?? (ingredient.proteinPer100g ?? 0) * factor,
          carbsSnapshot: carbsSnapshot ?? (ingredient.carbsPer100g ?? 0) * factor,
          fatSnapshot: fatSnapshot ?? (ingredient.fatPer100g ?? 0) * factor,
          ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
          amountGrams,
        },
      });

      return NextResponse.json({ registration, sharedCount: await share(registration) });
    }

    if (dishId) {
      const dish = await prisma.dish.findUnique({
        where: { id: dishId },
        include: { ingredients: { include: { product: true } } },
      });
      if (!dish) {
        return NextResponse.json({ message: "Ret ikke fundet" }, { status: 404 });
      }

      const totals = dish.ingredients.reduce(
        (acc, ingredient) => {
          const factor = ingredient.grams / 100;
          acc.grams += ingredient.grams;
          acc.kcal += ingredient.product.kcalPer100g * factor;
          acc.protein += ingredient.product.proteinPer100g * factor;
          acc.carbs += ingredient.product.carbsPer100g * factor;
          acc.fat += ingredient.product.fatPer100g * factor;
          return acc;
        },
        { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const scale = totals.grams > 0 ? amountGrams / totals.grams : 0;

      const registration = await prisma.registration.create({
        data: {
          userId: user.id,
          createdById,
          dishId: dish.id,
          titleSnapshot: dish.name,
          kcalSnapshot: kcalSnapshot ?? totals.kcal * scale,
          proteinSnapshot: proteinSnapshot ?? totals.protein * scale,
          carbsSnapshot: carbsSnapshot ?? totals.carbs * scale,
          fatSnapshot: fatSnapshot ?? totals.fat * scale,
          ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
          amountGrams,
        },
      });

      await fulfillMatchingForward(user.id, "DISH", dish.id);
      return NextResponse.json({ registration, sharedCount: await share(registration) });
    }

    if (
      !titleSnapshot ||
      kcalSnapshot === undefined ||
      proteinSnapshot === undefined ||
      carbsSnapshot === undefined ||
      fatSnapshot === undefined
    ) {
      return NextResponse.json(
        { message: "productId, eller titleSnapshot + alle snapshot-værdier, er påkrævet" },
        { status: 400 }
      );
    }

    const factor = amountGrams / 100;
    const product = await prisma.product.create({
      data: {
        name: titleSnapshot,
        kcalPer100g: kcalSnapshot / factor,
        proteinPer100g: proteinSnapshot / factor,
        carbsPer100g: carbsSnapshot / factor,
        fatPer100g: fatSnapshot / factor,
        status: "PENDING",
      },
    });

    const registration = await prisma.registration.create({
      data: {
        userId: user.id,
        createdById,
        productId: product.id,
        titleSnapshot,
        kcalSnapshot,
        proteinSnapshot,
        carbsSnapshot,
        fatSnapshot,
        amountGrams,
      },
    });

    return NextResponse.json({ registration, sharedCount: await share(registration) });
  } catch (error) {
    console.error("Registration create failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

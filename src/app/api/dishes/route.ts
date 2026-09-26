import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { stripPrivatePrefix } from "@/lib/private-ingredient-ids";
import { privateIngredientsAllowed } from "@/lib/private-ingredients";
import { MAX_RECIPE_IMAGES, MAX_RECIPE_STEPS } from "@/lib/recipe-categories";
import { isRecipeImagePath, storeRecipeImage } from "@/lib/recipe-image-storage";
import { suggestDishTags } from "@/lib/dish-details";

// GET /api/dishes — the user's own dishes (newest first).
export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    const dishes = await prisma.dish.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { ingredients: { include: { product: true } } },
    });
    return NextResponse.json({ dishes });
  } catch (error) {
    console.error("Dish list failed", error);
    return NextResponse.json(
      { dishes: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

type IngredientInput = { productId: string; grams: number };

// POST /api/dishes — create a custom dish from a list of ingredients
// (product + grams), added via search/barcode/manual creation in the
// same way as a regular food item (see /create-dish). Optional: images
// (up to 3 data URLs) and steps [{ title, text, image }]. The response
// carries suggestedTags (diets derived from the ingredients) for the
// category dialog shown after saving (docs/DECISIONS.md 2026-09-25).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const ingredients = Array.isArray(body.ingredients) ? (body.ingredients as IngredientInput[]) : [];

  if (!name) {
    return NextResponse.json({ message: "Navn er påkrævet" }, { status: 400 });
  }
  if (
    ingredients.length === 0 ||
    !ingredients.every(
      (i) => typeof i.productId === "string" && typeof i.grams === "number" && i.grams > 0
    )
  ) {
    return NextResponse.json(
      { message: "Mindst én ingrediens (produkt + gram > 0) er påkrævet" },
      { status: 400 }
    );
  }

  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    // Egne ingredienser kommer med "private:"-præfiks fra kladden.
    const rows = ingredients.map((i) => ({ productId: stripPrivatePrefix(i.productId), grams: i.grams }));
    if (!(await privateIngredientsAllowed(user.id, rows.map((i) => i.productId)))) {
      return NextResponse.json({ message: "Ukendt ingrediens" }, { status: 400 });
    }
    const images = (
      await Promise.all(
        (Array.isArray(body.images) ? body.images : []).slice(0, MAX_RECIPE_IMAGES).map(storeRecipeImage),
      )
    ).filter((path): path is string => path !== null);
    const rawSteps = Array.isArray(body.steps) ? (body.steps as Record<string, unknown>[]).slice(0, MAX_RECIPE_STEPS) : [];
    const steps = [];
    for (const raw of rawSteps) {
      const title = typeof raw?.title === "string" ? raw.title.trim().slice(0, 120) : "";
      const text = typeof raw?.text === "string" ? raw.text.trim().slice(0, 2000) : "";
      const image = await storeRecipeImage(raw?.image);
      if (title || text || image) steps.push({ title, text, image: image && isRecipeImagePath(image) ? image : null });
    }
    const dish = await prisma.dish.create({
      data: {
        name,
        ownerId: user.id,
        images,
        steps,
        ingredients: {
          create: rows,
        },
      },
      include: { ingredients: { include: { product: true } } },
    });
    return NextResponse.json({ dish, suggestedTags: suggestDishTags(dish) }, { status: 201 });
  } catch (error) {
    console.error("Dish creation failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

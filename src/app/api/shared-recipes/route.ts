import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  parseIngredients,
  publisherHashFrom,
  searchTextFor,
  toPublicRecipe,
  totalsFor,
} from "@/lib/shared-recipes";

// Delte brugeropskrifter (docs/DECISIONS.md 2026-09-24).
//
// GET ?q=&sort=relevance|popular|date&hellofresh=1 — søg i delte retter.
// Afviste retter og retter fra blokerede udgivere vises ikke. Med
// hellofresh=1 (brugeren har slået HelloFresh til under Integrationer)
// medtages HelloFresh-opskrifterne i samme liste.
type Sort = "relevance" | "popular" | "date";

type Item = {
  kind: "shared" | "hellofresh";
  id: string;
  name: string;
  imageUrl: string | null;
  kcal: number;
  popularity: number;
  createdAt: string;
  score: number;
};

function relevance(name: string, searchText: string, q: string) {
  if (!q) return 0;
  const lower = name.toLowerCase();
  if (lower.startsWith(q)) return 3;
  if (lower.includes(q)) return 2;
  return searchText.includes(q) ? 1 : 0;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const sortParam = params.get("sort");
  const sort: Sort = sortParam === "popular" || sortParam === "date" ? sortParam : "relevance";
  const includeHelloFresh = params.get("hellofresh") === "1";

  try {
    const blocked = await prisma.sharedRecipePublisherBlock.findMany({ select: { publisherHash: true } });
    const recipes = await prisma.sharedRecipe.findMany({
      where: {
        status: { not: "REJECTED" },
        publisherHash: { notIn: blocked.map((b) => b.publisherHash) },
        ...(q ? { searchText: { contains: q } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const items: Item[] = recipes.map((r) => ({
      kind: "shared",
      id: r.id,
      name: r.name,
      imageUrl: null,
      // Hele retten; brugeroprettede retter har (endnu) intet portionsantal.
      kcal: Math.round(r.kcal),
      popularity: r.popularity,
      createdAt: r.createdAt.toISOString(),
      score: relevance(r.name, r.searchText, q),
    }));

    if (includeHelloFresh) {
      const products = await prisma.product.findMany({
        where: {
          externalSource: "HELLOFRESH",
          discontinued: false,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { ingredientsText: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          kcalPer100g: true,
          servingSizeGrams: true,
          ingredientsText: true,
          createdAt: true,
        },
      });
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const usage = products.length
        ? await prisma.productUsageDaily.groupBy({
            by: ["productId"],
            where: { productId: { in: products.map((p) => p.id) }, day: { gte: cutoff } },
            _sum: { count: true },
          })
        : [];
      const usageById = new Map(usage.map((u) => [u.productId, u._sum.count ?? 0]));
      for (const p of products) {
        items.push({
          kind: "hellofresh",
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          kcal: Math.round((p.kcalPer100g * (p.servingSizeGrams ?? 100)) / 100),
          popularity: usageById.get(p.id) ?? 0,
          createdAt: p.createdAt.toISOString(),
          score: relevance(p.name, `${p.name} ${p.ingredientsText ?? ""}`.toLowerCase(), q),
        });
      }
    }

    items.sort((a, b) => {
      if (sort === "popular") return b.popularity - a.popularity || b.createdAt.localeCompare(a.createdAt);
      if (sort === "date") return b.createdAt.localeCompare(a.createdAt);
      return b.score - a.score || b.popularity - a.popularity || b.createdAt.localeCompare(a.createdAt);
    });

    return NextResponse.json({
      recipes: items.slice(0, 60).map((item) => ({
        kind: item.kind,
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        kcal: item.kcal,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Shared recipe search failed", error);
    return NextResponse.json({ recipes: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// POST { name, language, ingredients } + udgivertoken i headeren — del en ret.
// Kræver en session (mod spam), men hverken bruger- eller sessions-ID gemmes.
// Retten er synlig med det samme og venter på admin-godkendelse.
export async function POST(req: Request) {
  if (!(await getSessionUser())) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const publisherHash = publisherHashFrom(req);
  if (!publisherHash) return NextResponse.json({ message: "Udgivertoken mangler" }, { status: 400 });

  const blocked = await prisma.sharedRecipePublisherBlock.findUnique({ where: { publisherHash } });
  if (blocked) return NextResponse.json({ message: "Du kan ikke dele retter i øjeblikket" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const language = body?.language === "en" ? "en" : "da";
  const ingredients = parseIngredients(body?.ingredients);
  if (!name || !ingredients) return NextResponse.json({ message: "Ugyldig ret" }, { status: 400 });

  const recipe = await prisma.sharedRecipe.create({
    data: {
      publisherHash,
      name,
      language,
      ingredients,
      searchText: searchTextFor(name, ingredients),
      ...totalsFor(ingredients),
    },
  });
  return NextResponse.json({ recipe: toPublicRecipe(recipe) }, { status: 201 });
}

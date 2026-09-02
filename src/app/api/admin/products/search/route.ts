import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// GET /api/admin/products/search?q=rugbrød — search in the approved database
// for admin editing (docs/ADMIN.md "Edit products").
export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: { brand: true },
    take: 20,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ products });
}

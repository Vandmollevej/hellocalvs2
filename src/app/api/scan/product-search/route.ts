import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";

// Enkel navne-/brandsøgning til "ret tildeling" i hyldeoverlayet.
export async function GET(req: Request) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: {
      status: { not: "REJECTED" },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { subbrand: { contains: q, mode: "insensitive" } },
        { barcodes: { some: { code: q } } },
      ],
    },
    select: { id: true, name: true, imageUrl: true, packageSizeText: true, brand: { select: { name: true } } },
    take: 15,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}

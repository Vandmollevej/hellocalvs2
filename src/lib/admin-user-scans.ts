import { prisma } from "@/lib/prisma";

// Admin "Varedatabase → Brugerscanninger" (bruger 2026-10-17): alle varer,
// brugerne scanner — både kendte varer (ProductScan, fx fra Open Food Facts)
// og varer en bruger selv har oprettet med stregkode — nyeste først, så admin
// kan rette dem. Én række pr. bruger og vare.

const LIMIT = 300;

export type AdminUserScanRow = {
  key: string;
  productId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  source: string;
  status: string;
  userName: string;
  at: Date;
  created: boolean;
};

const productSelect = {
  id: true,
  name: true,
  imageUrl: true,
  externalSource: true,
  status: true,
  createdAt: true,
  brand: { select: { name: true } },
} as const;

export async function loadAdminUserScans(): Promise<AdminUserScanRow[]> {
  const [scans, created] = await Promise.all([
    prisma.productScan.findMany({
      where: { product: { deletedAt: null } },
      orderBy: { scannedAt: "desc" },
      take: LIMIT,
      select: { scannedAt: true, user: { select: { id: true, displayName: true } }, product: { select: productSelect } },
    }),
    prisma.product.findMany({
      where: { createdByUserId: { not: null }, deletedAt: null, barcodes: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { ...productSelect, createdBy: { select: { id: true, displayName: true } } },
    }),
  ]);

  const rows = new Map<string, AdminUserScanRow>();
  const add = (
    product: (typeof scans)[number]["product"],
    user: { id: string; displayName: string } | null,
    at: Date,
    isCreated: boolean,
  ) => {
    if (!user) return;
    const key = `${user.id}:${product.id}`;
    const current = rows.get(key);
    if (current && current.at >= at) {
      current.created ||= isCreated;
      return;
    }
    rows.set(key, {
      key,
      productId: product.id,
      name: product.name,
      brand: product.brand?.name ?? null,
      imageUrl: product.imageUrl,
      source: product.externalSource ?? "USER",
      status: product.status,
      userName: user.displayName,
      at,
      created: isCreated || (current?.created ?? false),
    });
  };
  for (const scan of scans) add(scan.product, scan.user, scan.scannedAt, false);
  for (const product of created) add(product, product.createdBy, product.createdAt, true);

  return [...rows.values()].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, LIMIT);
}

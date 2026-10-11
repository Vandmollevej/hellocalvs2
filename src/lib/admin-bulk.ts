import { prisma } from "@/lib/prisma";
import { approveProduct } from "@/lib/product-approval";
import type { BulkAction, BulkKind } from "@/lib/admin-bulk-actions";

// Udfører en admin-handling på flere varer/retter ad gangen
// (docs/DECISIONS.md 2026-10-11). Returnerer antal rækker, der blev ændret.
//
//   DISABLE  discontinued = true            (skjult for brugerne, som "Disable" altid har været)
//   ENABLE   discontinued = false
//   APPROVE  status APPROVED                (varer: points/besked til indsenderen som ved enkelt-godkendelse)
//   REVIEW   status PENDING                 (kommer i gennemsynskøen)
//   DELETE   deletedAt = nu, status REJECTED, discontinued = true
//   RESTORE  deletedAt = null, status PENDING, discontinued = false

export async function runBulkAction(kind: BulkKind, action: BulkAction, ids: string[]): Promise<number> {
  return kind === "product" ? runProductAction(action, ids) : runRecipeAction(action, ids);
}

async function runProductAction(action: BulkAction, ids: string[]): Promise<number> {
  // Slettede rækker ændres kun af Gendan, så en gammel markering ikke kan
  // godkende eller aktivere noget, der er slettet.
  const live = { id: { in: ids }, deletedAt: null };
  switch (action) {
    case "DISABLE":
      return (await prisma.product.updateMany({ where: live, data: { discontinued: true } })).count;
    case "ENABLE":
      return (await prisma.product.updateMany({ where: live, data: { discontinued: false } })).count;
    case "REVIEW":
      return (await prisma.product.updateMany({ where: live, data: { status: "PENDING" } })).count;
    case "APPROVE": {
      // Brugerindsendte varer får points og besked via den fælles godkendelse;
      // resten (importerede varer og retter) sættes direkte.
      const rows = await prisma.product.findMany({ where: live, select: { id: true, createdByUserId: true, externalSource: true } });
      const withPoints = rows.filter((row) => row.createdByUserId && row.externalSource === null).map((row) => row.id);
      const direct = rows.filter((row) => !withPoints.includes(row.id)).map((row) => row.id);
      let changed = 0;
      for (const id of withPoints) {
        if (await approveProduct(id)) changed += 1;
      }
      if (direct.length > 0) {
        changed += (await prisma.product.updateMany({ where: { id: { in: direct } }, data: { status: "APPROVED", approvalToken: null } })).count;
      }
      return changed;
    }
    case "DELETE":
      return (
        await prisma.product.updateMany({
          where: live,
          data: { deletedAt: new Date(), status: "REJECTED", discontinued: true, approvalToken: null },
        })
      ).count;
    case "RESTORE":
      return (
        await prisma.product.updateMany({
          where: { id: { in: ids }, deletedAt: { not: null } },
          data: { deletedAt: null, status: "PENDING", discontinued: false },
        })
      ).count;
  }
}

// Brugeroprettede retter har ingen "discontinued": Disable = afvist (skjult for
// andre, ejeren beholder retten i sin boks, som ved Afvis under Kvalitetskontrol).
async function runRecipeAction(action: BulkAction, ids: string[]): Promise<number> {
  const live = { id: { in: ids }, deletedAt: null };
  const now = new Date();
  switch (action) {
    case "DISABLE":
      return (await prisma.sharedRecipe.updateMany({ where: live, data: { status: "REJECTED", reviewedAt: now } })).count;
    case "ENABLE":
    case "APPROVE":
      return (await prisma.sharedRecipe.updateMany({ where: live, data: { status: "APPROVED", reviewedAt: now } })).count;
    case "REVIEW":
      return (await prisma.sharedRecipe.updateMany({ where: live, data: { status: "PENDING", reviewedAt: null } })).count;
    case "DELETE":
      return (await prisma.sharedRecipe.updateMany({ where: live, data: { deletedAt: now, status: "REJECTED", reviewedAt: now } })).count;
    case "RESTORE":
      return (
        await prisma.sharedRecipe.updateMany({
          where: { id: { in: ids }, deletedAt: { not: null } },
          data: { deletedAt: null, status: "PENDING", reviewedAt: null },
        })
      ).count;
  }
}

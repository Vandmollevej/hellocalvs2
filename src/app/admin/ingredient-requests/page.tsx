import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { IngredientRequestActions } from "@/components/admin/IngredientRequestActions";

// Ønskede ingredienser (docs/DECISIONS.md 2026-09-24): brugere har oprettet
// en privat ingrediens, som ikke fandtes. Anmodningen er anonym. "Tilføj
// globalt" opretter en GenericIngredient og erstatter brugerens private.
export default async function AdminIngredientRequestsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const requests = await prisma.ingredientRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Ønskede ingredienser</h1>
        <p className="text-sm text-text-secondary">
          Ingredienser brugere har oprettet selv, fordi de ikke fandtes. Tilføjes de globalt, får alle adgang, og
          brugerens egen udgave erstattes automatisk. Du kan rette navnet først.
        </p>
      </div>
      {requests.length === 0 ? (
        <p className="text-sm text-text-secondary">Intet afventer.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-border-strong bg-surface-2 p-4">
              <p className="text-xs text-text-secondary">{request.createdAt.toLocaleString("da-DK")}</p>
              <IngredientRequestActions id={request.id} name={request.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

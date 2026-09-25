import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { KEY_GROUPS } from "@/lib/api-keys/catalog";
import { ensureSecretsLoaded } from "@/lib/api-keys/store";
import { allServiceStatuses } from "@/lib/api-keys/status";
import { ApiKeysManager } from "@/components/admin/ApiKeysManager";

export const dynamic = "force-dynamic";

export default async function AdminApiKeysPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  await ensureSecretsLoaded();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">API-nøgler</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Overblik over alle nøgler appen bruger. Hemmelige værdier vises aldrig — kun de sidste fire tegn. En nøgle
          rettet her gemmes krypteret og virker med det samme; “Brug .env igen” går tilbage til værdien i
          .env.production.
        </p>
      </div>
      <ApiKeysManager groups={KEY_GROUPS} initialServices={allServiceStatuses()} />
    </div>
  );
}

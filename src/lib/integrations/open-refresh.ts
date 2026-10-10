import type { IntegrationProvider } from "@prisma/client";

// "Hent ved næste åbning": data, der kommer ofte (Withings-aktivitet), hentes
// ikke ved hver notifikation, men først når brugeren har appen fremme
// (POST /api/integrations/app-open). Kun i hukommelsen: går den tabt ved en
// genstart, henter baggrundsjobbet dataene som før.
const pending = new Map<string, Set<IntegrationProvider>>();

export function markFetchOnOpen(userId: string, provider: IntegrationProvider) {
  const providers = pending.get(userId) ?? new Set<IntegrationProvider>();
  providers.add(provider);
  pending.set(userId, providers);
}

export function takeFetchOnOpen(userId: string): IntegrationProvider[] {
  const providers = pending.get(userId);
  if (!providers) return [];
  pending.delete(userId);
  return [...providers];
}

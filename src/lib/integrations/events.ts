import type { IntegrationEventType, IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Hændelseslog til admin → Integrationer (docs/DECISIONS.md 2026-10-02).
// Loggen må aldrig vælte brugerens handling, så fejl sluges og logges kun.
export async function recordIntegrationEvent(
  userId: string,
  provider: IntegrationProvider,
  type: IntegrationEventType,
  itemCount?: number
) {
  try {
    await prisma.integrationEvent.create({ data: { userId, provider, type, itemCount: itemCount ?? null } });
  } catch (error) {
    console.error("Integration event not recorded", type, error instanceof Error ? error.message : "ukendt");
  }
}

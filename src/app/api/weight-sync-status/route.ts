import { NextResponse } from "next/server";
import { unauthorized, getSessionUser } from "@/lib/session";
import { listIntegrationStatuses } from "@/lib/integrations";
import { getAttireSettings } from "@/lib/weight-attire-server";

// GET — synk-status for de forbundne integrationer, der leverer vægt, så
// vægtsiden kan vise hvornår der sidst blev synkroniseret (2026-10-07).
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const settings = await getAttireSettings();
    const all = await listIntegrationStatuses(user.id);
    const integrations = all
      .filter((item) => item.status !== "DISCONNECTED" && item.capabilities.read.includes("weight"))
      .map((item) => {
        const lastSyncedAt = item.lastSyncedAt;
        const ageMs = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() : Infinity;
        return {
          provider: item.provider,
          label: item.label,
          icon: item.icon,
          slug: item.slug,
          pageSlug: item.pageSlug,
          // Kun cloud-integrationer kan synkes fra serveren; telefon-hubs sender selv.
          canSyncNow: item.kind === "oauth",
          status: item.status,
          lastSyncedAt,
          lastError: item.lastError,
          stale: item.status === "ERROR" || ageMs > settings.syncStaleHours * 3_600_000,
        };
      });
    return NextResponse.json({ integrations, staleHours: settings.syncStaleHours });
  } catch (error) {
    console.error("Weight sync status failed", error);
    return NextResponse.json({ integrations: [], staleHours: 48 });
  }
}

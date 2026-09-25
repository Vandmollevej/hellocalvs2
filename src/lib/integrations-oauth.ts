import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isBase64Url } from "@/lib/vault/server";
import type { OAuthTokens } from "@/lib/integrations/types";

// Fælles OAuth-tilstand for cloud-integrationerne (docs/PRIVACY.md). Klienten
// opretter en anonym indbakke og sender dens ID med ved tilkobling; ID'et
// følger OAuth-flowet i tilstandscookien og gemmes på integrationen, så
// hentede data kan forsegles til brugerens boks.

type State = { state: string; inboxId: string };

export function newOAuthState(): string {
  return randomUUID();
}

export function setOAuthCookie(response: NextResponse, cookieName: string, value: State) {
  response.cookies.set(cookieName, JSON.stringify(value), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export function readOAuthState(req: NextRequest, cookieName: string): State | null {
  try {
    const parsed = JSON.parse(req.cookies.get(cookieName)?.value ?? "") as Partial<State>;
    return typeof parsed.state === "string" && typeof parsed.inboxId === "string"
      ? { state: parsed.state, inboxId: parsed.inboxId }
      : null;
  } catch {
    return null;
  }
}

export async function isValidInbox(inboxId: unknown): Promise<boolean> {
  if (!isBase64Url(inboxId, 64)) return false;
  return Boolean(await prisma.vaultInbox.findUnique({ where: { id: inboxId }, select: { id: true } }));
}

export async function saveIntegrationTokens(
  provider: IntegrationProvider,
  inboxId: string,
  tokens: OAuthTokens
) {
  const user = await getSessionUser();
  if (!user) throw new Error("Ikke logget ind");
  const data = {
    status: "CONNECTED" as const,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    scope: tokens.scope ?? null,
    lastSyncedAt: null,
    connectedAt: new Date(),
    lastError: null,
    inboxId,
  };
  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider } },
    create: { userId: user.id, provider, ...data },
    update: data,
  });
}

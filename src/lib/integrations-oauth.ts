import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import type { OAuthTokens } from "@/lib/integrations/types";

// Fælles OAuth-tilstand for cloud-integrationerne (CSRF-state i en cookie).

type State = { state: string };

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
    return typeof parsed.state === "string" ? { state: parsed.state } : null;
  } catch {
    return null;
  }
}

export async function saveIntegrationTokens(
  provider: IntegrationProvider,
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
  };
  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider } },
    create: { userId: user.id, provider, ...data },
    update: data,
  });
}

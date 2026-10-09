import { createHash, randomBytes, randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import type { OAuthTokens } from "@/lib/integrations/types";
import { recordIntegrationEvent } from "@/lib/integrations/events";

// Fælles OAuth-tilstand for cloud-integrationerne (CSRF-state i en cookie;
// ved PKCE også code_verifier).

// native: signeret binding til brugeren, når tilkoblingen er startet fra den
// native app i system-browseren (src/lib/native-auth.ts).
type State = { state: string; verifier?: string; native?: string };

export function newOAuthState(prefix = ""): string {
  return prefix + randomUUID();
}

// PKCE (RFC 7636, S256).
export function newPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
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
    if (typeof parsed.state !== "string") return null;
    const state: State = { state: parsed.state };
    if (typeof parsed.verifier === "string") state.verifier = parsed.verifier;
    if (typeof parsed.native === "string") state.native = parsed.native;
    return state;
  } catch {
    return null;
  }
}

export async function saveIntegrationTokens(
  provider: IntegrationProvider,
  tokens: OAuthTokens,
  externalUserId?: string,
  // Native tilkobling: brugeren fra den signerede binding i state-cookien
  // (system-browseren har ingen session).
  nativeUserId?: string
) {
  const user = nativeUserId ? { id: nativeUserId } : await getSessionUser();
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
    ...(externalUserId ? { externalUserId } : {}),
  };
  const where = { userId_provider: { userId: user.id, provider } };
  const previous = await prisma.integration.findUnique({ where, select: { status: true } });
  await prisma.integration.upsert({
    where,
    create: { userId: user.id, provider, ...data },
    update: data,
  });
  // Ny tilkobling tæller kun, når den ikke allerede var forbundet (fornyet adgang er ikke en ny installation).
  if (!previous || previous.status === "DISCONNECTED") await recordIntegrationEvent(user.id, provider, "CONNECTED");
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OAUTH_STATE_COOKIE, appUrl, fetchProfile, findOrCreateUser, isProviderSlug, readState } from "@/lib/oauth";
import { completeLogin } from "@/lib/user-login";
import { NATIVE_STATE_PREFIX, createNativeCode, nativeLoginUrl } from "@/lib/native-auth";

// Svaret fra Google/Facebook (GET) og Apple (POST, form_post).
async function handle(req: Request, provider: string, fields: URLSearchParams) {
  // Login startet fra den native app sendes tilbage til appen (hellocal://),
  // også ved fejl — state-præfikset er kun et hint om, hvor fejlen skal vises.
  const nativeHint = fields.get("state")?.startsWith(NATIVE_STATE_PREFIX) ?? false;
  const fail = (reason: string) => {
    const response = NextResponse.redirect(
      nativeHint ? nativeLoginUrl({ error: reason }) : appUrl(`/login?error=${reason}`, req),
      303
    );
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/auth/oauth", maxAge: 0 });
    return response;
  };
  if (!isProviderSlug(provider)) return fail("oauth");

  // Brugeren trykkede "annuller" hos udbyderen.
  if (fields.get("error")) return fail("oauth-cancelled");

  const store = await cookies();
  const state = await readState(store.get(OAUTH_STATE_COOKIE)?.value);
  const code = fields.get("code");
  if (!state || state.provider !== provider || state.state !== fields.get("state") || !code) {
    return fail("oauth-expired");
  }

  try {
    const profile = await fetchProfile(provider, code, state.nonce, fields.get("user"));
    const result = await findOrCreateUser(provider, profile, state.consent);
    if (!result) return fail("oauth");

    // Native app: system-browseren får ingen session. Appen får en engangskode,
    // som kun kan veksles sammen med appens PKCE-verifier
    // (POST /api/auth/native/exchange, docs/DECISIONS.md 2026-10-08).
    if (state.native && state.challenge) {
      const nativeCode = await createNativeCode(result.user.id, "LOGIN", {
        method: provider,
        codeChallenge: state.challenge,
      });
      const query: Record<string, string> = { code: nativeCode };
      if (state.next !== "/") query.next = state.next;
      const response = NextResponse.redirect(nativeLoginUrl(query), 303);
      response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/auth/oauth", maxAge: 0 });
      return response;
    }

    const response = NextResponse.redirect(appUrl(state.next, req), 303);
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/auth/oauth", maxAge: 0 });
    return completeLogin(req, response, result.user.id, provider);
  } catch (error) {
    console.error(`OAuth login via ${provider} failed`, error);
    return fail("oauth");
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return handle(req, provider, new URL(req.url).searchParams);
}

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const form = await req.formData().catch(() => null);
  const fields = new URLSearchParams();
  form?.forEach((value, key) => {
    if (typeof value === "string") fields.set(key, value);
  });
  return handle(req, provider, fields);
}

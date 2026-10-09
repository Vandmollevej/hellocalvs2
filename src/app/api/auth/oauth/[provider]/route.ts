import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
  appUrl,
  authorizationUrl,
  createState,
  isProviderConfigured,
  isProviderSlug,
} from "@/lib/oauth";
import { isValidChallenge, nativeLoginUrl } from "@/lib/native-auth";

// GET /api/auth/oauth/google|apple|facebook?next=/ — send brugeren til
// udbyderens login. Knapperne på /login og /signup peger hertil.
// Den native app åbner ?native=1&challenge=<S256> i system-browseren og får
// svaret tilbage som hellocal://auth/complete?code=… (src/lib/native-auth.ts).
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProviderSlug(provider)) return NextResponse.json({ message: "Ukendt udbyder" }, { status: 404 });

  const searchParams = new URL(req.url).searchParams;
  const native = searchParams.get("native") === "1";
  const challenge = searchParams.get("challenge");
  if (native && !isValidChallenge(challenge)) {
    return NextResponse.redirect(nativeLoginUrl({ error: "oauth" }));
  }
  if (!isProviderConfigured(provider)) {
    return NextResponse.redirect(
      native ? nativeLoginUrl({ error: `${provider}-not-configured` }) : appUrl(`/login?error=${provider}-not-configured`, req)
    );
  }

  const next = searchParams.get("next") ?? "/";
  const { data, token } = await createState(
    provider,
    next,
    searchParams.get("consent") === "1",
    native ? challenge : null
  );
  const response = NextResponse.redirect(authorizationUrl(provider, data));
  // SameSite=None: Apple sender svaret som en POST fra appleid.apple.com.
  response.cookies.set(OAUTH_STATE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/api/auth/oauth",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return response;
}

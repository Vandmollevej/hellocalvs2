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

// GET /api/auth/oauth/google|apple|facebook?next=/ — send brugeren til
// udbyderens login. Knapperne på /login og /signup peger hertil.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProviderSlug(provider)) return NextResponse.json({ message: "Ukendt udbyder" }, { status: 404 });
  if (!isProviderConfigured(provider)) {
    return NextResponse.redirect(appUrl(`/login?error=${provider}-not-configured`, req));
  }

  const next = new URL(req.url).searchParams.get("next") ?? "/";
  const { data, token } = await createState(provider, next);
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

import type { NextRequest } from "next/server";
import { callback } from "@/lib/integrations/handlers";
import { withings } from "@/lib/integrations/withings";

// Alternativ redirect-URI (…/api/withings/callback), så den URI der er
// registreret hos Withings virker. Kræver WITHINGS_REDIRECT_URI sat til den.
export function GET(req: NextRequest) {
  return callback(req, withings);
}

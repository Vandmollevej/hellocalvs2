import type { NextRequest } from "next/server";
import { callback } from "@/lib/integrations/handlers";
import { googleHealth } from "@/lib/integrations/google-health";

// Alternativ redirect-URI (…/api/google-health/callback), så den URI der er
// registreret i Google Cloud virker. Kræver GOOGLE_HEALTH_REDIRECT_URI sat til den.
export function GET(req: NextRequest) {
  return callback(req, googleHealth);
}

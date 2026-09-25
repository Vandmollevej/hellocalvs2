import { getSessionUser, unauthorized } from "@/lib/session";
import { passkeyChallengeResponse } from "@/lib/user-passkey";

// "Bekræft at det er dig" med Face ID for den allerede indloggede bruger.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return passkeyChallengeResponse(req, user.id);
}

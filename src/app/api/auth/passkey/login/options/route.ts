import { passkeyChallengeResponse } from "@/lib/user-passkey";

// Log ind med Face ID: ingen e-mail først — telefonen viser selv kontoen.
export async function POST(req: Request) {
  return passkeyChallengeResponse(req);
}

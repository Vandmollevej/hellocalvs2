import { NextResponse } from "next/server";
import { ensureDefaultMessageTemplates, queueMessage } from "@/lib/messaging";
import { createStartWeightChangeToken } from "@/lib/start-weight-verification";
import { getSessionUser, unauthorized } from "@/lib/session";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

// Sender verificeringsmail til ændring af den låste start-vægt
// (docs/DECISIONS.md 2026-09-22). Brugeren findes server-side — body læses
// ikke, så klienten kan aldrig angive userId/e-mail. Samme identitetskilde
// som /api/profile (getSessionUser), så linket ændrer den bruger profilsiden
// viser; skal migreres sammen med /api/profile til rigtig session.
export async function POST() {
  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    if (!user.email || user.forgottenAt) {
      return NextResponse.json({ message: "Kunne ikke sende verificeringsmail" }, { status: 400 });
    }

    const rawToken = await createStartWeightChangeToken(user.id);
    const verificationLink = `${APP_BASE_URL}/profile/start-weight/verify?token=${rawToken}`;

    // Skabeloner seedes ellers kun når admin åbner Besked automatisering —
    // uden skabelon ville mailen blive SKIPPED. Upsert overskriver aldrig.
    await ensureDefaultMessageTemplates();
    await queueMessage("START_WEIGHT_CHANGE", {
      userId: user.id,
      vars: { displayName: user.displayName, verificationLink },
    });

    return NextResponse.json({ ok: true });
  } catch {
    console.error("Start-weight verification request failed");
    return NextResponse.json({ message: "Kunne ikke sende verificeringsmail" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { canActFor, logProfileAccess } from "@/lib/family-access";
import { readJson } from "@/lib/family-api";

// "Kopier til konto": en af den indloggedes egne registreringer kopieres til
// en profil, vedkommende styrer. Kopien er et nyt snapshot med samme
// næringsværdier og tidspunkt (snapshot-semantik som alle registreringer).
export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : "";
  const targetProfileId = typeof body.targetProfileId === "string" ? body.targetProfileId : "";
  if (!registrationId || !targetProfileId || targetProfileId === login.id) {
    return NextResponse.json({ code: "invalidRequest" }, { status: 400 });
  }
  if (!(await canActFor(login.id, targetProfileId))) {
    return NextResponse.json({ code: "notAllowed" }, { status: 403 });
  }

  const source = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!source || source.userId !== login.id) return NextResponse.json({ code: "notFound" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, userId, ...snapshot } = source;
  const copy = await prisma.registration.create({ data: { ...snapshot, userId: targetProfileId } });
  await logProfileAccess(targetProfileId, login.id, "CREATED", "registrations");
  return NextResponse.json({ registration: { id: copy.id } }, { status: 201 });
}

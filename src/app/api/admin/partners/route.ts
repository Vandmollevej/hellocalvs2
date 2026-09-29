import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { isValidEmail } from "@/lib/partner-reports";

// Admin "Partnere" (docs/DECISIONS.md 2026-09-29): partnere, kontakter og
// reklame-lokationer. Én action-baseret POST for at holde det samlet.
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  switch (body.action) {
    case "createPartner": {
      const name = str(body.name);
      if (!name) return NextResponse.json({ message: "Angiv et navn" }, { status: 400 });
      await prisma.partner.create({ data: { name } });
      break;
    }
    case "deletePartner": {
      await prisma.partner.delete({ where: { id: str(body.id) } });
      break;
    }
    case "createContact": {
      const name = str(body.name);
      const email = str(body.email).toLowerCase();
      if (!name || !isValidEmail(email)) return NextResponse.json({ message: "Angiv navn og gyldig e-mail" }, { status: 400 });
      await prisma.partnerContact.create({ data: { partnerId: str(body.partnerId), name, email } });
      break;
    }
    case "toggleContact": {
      await prisma.partnerContact.update({ where: { id: str(body.id) }, data: { active: body.active === true } });
      break;
    }
    case "deleteContact": {
      await prisma.partnerContact.delete({ where: { id: str(body.id) } });
      break;
    }
    case "createLocation": {
      const name = str(body.name);
      if (!name) return NextResponse.json({ message: "Angiv et navn" }, { status: 400 });
      await prisma.adLocation.create({ data: { partnerId: str(body.partnerId), name, placement: str(body.placement) } });
      break;
    }
    case "deleteLocation": {
      await prisma.adLocation.delete({ where: { id: str(body.id) } });
      break;
    }
    default:
      return NextResponse.json({ message: "Ukendt handling" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

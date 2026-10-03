import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { isValidEmail } from "@/lib/partner-reports";
import { inventoryItem } from "@/lib/ad-inventory";
import type { PartnerPaymentMethod, ProductCategory } from "@prisma/client";

// Admin "Partnere" (docs/DECISIONS.md 2026-09-29): partnere, kontakter og
// reklame-lokationer. Én action-baseret POST for at holde det samlet.
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const optInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const optDate = (value: unknown) => {
  const s = str(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const PRODUCT_CATEGORIES: ProductCategory[] = ["DRINK", "VEGETABLES", "GENERIC", "PROCESSED", "RAW", "INGREDIENT"];
const PAYMENT_METHODS: PartnerPaymentMethod[] = ["INVOICE", "BANK_TRANSFER", "CARD", "MOBILEPAY"];
const PARTNER_TEXT_FIELDS = [
  "cvr", "addressStreet", "addressZip", "addressCity", "phone",
  "contactName", "contactEmail", "contactPhone", "managerName", "managerTitle", "managerEmail",
] as const;
const BILLING_TEXT_FIELDS = ["billingName", "billingEmail", "billingAddress", "ean", "billingReference", "paymentNote"] as const;

// Felter på et reklamespot (banner, link, aftalte tal, triggere, aftale).
async function locationFields(body: Record<string, unknown>, partnerId: string) {
  const agreementId = str(body.agreementId) || null;
  if (agreementId) {
    const agreement = await prisma.sponsorAgreement.findUnique({ where: { id: agreementId }, select: { partnerId: true } });
    if (!agreement || agreement.partnerId !== partnerId) throw new Error("Aftalen tilhører ikke partneren");
  }
  const inventoryKey = str(body.inventoryKey);
  if (inventoryKey && !inventoryItem(inventoryKey)) throw new Error("Ukendt reklamemulighed");
  const category = str(body.triggerCategory) as ProductCategory;
  return {
    inventoryKey,
    placement: str(body.placement) || inventoryItem(inventoryKey)?.placement || "",
    bannerUrl: str(body.bannerUrl),
    targetUrl: str(body.targetUrl),
    agreedImpressions: optInt(body.agreedImpressions),
    agreedClicks: optInt(body.agreedClicks),
    triggerCategory: PRODUCT_CATEGORIES.includes(category) ? category : null,
    triggerProductType: str(body.triggerProductType) || null,
    agreementId,
  };
}

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
      const partnerId = str(body.partnerId);
      if (!name || !partnerId) return NextResponse.json({ message: "Angiv et navn" }, { status: 400 });
      try {
        await prisma.adLocation.create({ data: { partnerId, name, ...(await locationFields(body, partnerId)) } });
      } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Ugyldig anmodning" }, { status: 400 });
      }
      break;
    }
    case "updateLocation": {
      const location = await prisma.adLocation.findUnique({ where: { id: str(body.id) }, select: { partnerId: true } });
      if (!location) return NextResponse.json({ message: "Spottet findes ikke" }, { status: 404 });
      const name = str(body.name);
      if (!name) return NextResponse.json({ message: "Angiv et navn" }, { status: 400 });
      try {
        await prisma.adLocation.update({ where: { id: str(body.id) }, data: { name, ...(await locationFields(body, location.partnerId)) } });
      } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Ugyldig anmodning" }, { status: 400 });
      }
      break;
    }
    // --- Partnersiden (docs/DECISIONS.md 2026-10-02) ---
    case "updatePartner": {
      const name = str(body.name);
      if (!name) return NextResponse.json({ message: "Angiv et navn" }, { status: 400 });
      for (const key of ["contactEmail", "managerEmail"] as const) {
        if (str(body[key]) && !isValidEmail(str(body[key]))) return NextResponse.json({ message: "Ugyldig e-mail" }, { status: 400 });
      }
      const data = Object.fromEntries(PARTNER_TEXT_FIELDS.map((key) => [key, str(body[key])]));
      await prisma.partner.update({ where: { id: str(body.id) }, data: { name, ...data } });
      break;
    }
    case "updateBilling": {
      if (str(body.billingEmail) && !isValidEmail(str(body.billingEmail))) return NextResponse.json({ message: "Ugyldig e-mail" }, { status: 400 });
      const method = str(body.paymentMethod) as PartnerPaymentMethod;
      const data = Object.fromEntries(BILLING_TEXT_FIELDS.map((key) => [key, str(body[key])]));
      await prisma.partner.update({
        where: { id: str(body.id) },
        data: {
          ...data,
          paymentTermsDays: Math.min(Math.max(Math.round(num(body.paymentTermsDays, 14)), 0), 365),
          ...(PAYMENT_METHODS.includes(method) ? { paymentMethod: method } : {}),
        },
      });
      break;
    }
    case "createAgreement":
    case "updateAgreement": {
      const title = str(body.title);
      const startsAt = optDate(body.startsAt);
      if (!title || !startsAt) return NextResponse.json({ message: "Angiv titel og startdato" }, { status: 400 });
      const endsAt = optDate(body.endsAt);
      if (endsAt && endsAt <= startsAt) return NextResponse.json({ message: "Slutdato skal ligge efter startdato" }, { status: 400 });
      const data = {
        title,
        startsAt,
        endsAt,
        active: body.active !== false,
        budgetDkk: Math.round(num(body.budgetDkk)),
        cpmDkk: num(body.cpmDkk),
        cpcDkk: num(body.cpcDkk),
        notes: str(body.notes),
      };
      if (body.action === "createAgreement") {
        const partnerId = str(body.partnerId);
        if (!partnerId) return NextResponse.json({ message: "Partner mangler" }, { status: 400 });
        await prisma.sponsorAgreement.create({ data: { partnerId, ...data } });
      } else {
        await prisma.sponsorAgreement.update({ where: { id: str(body.id) }, data });
      }
      break;
    }
    case "deleteAgreement": {
      await prisma.sponsorAgreement.delete({ where: { id: str(body.id) } });
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

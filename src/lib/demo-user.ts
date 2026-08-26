import { prisma } from "@/lib/prisma";

// Login er endnu ikke implementeret. Indtil da samles den afgrænsede
// produktprøves data på én demo-bruger, så UI og database bruger samme kilde.
const DEMO_USER_EMAIL = "demo@hellocal.local";

export function getDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, displayName: "Demo" },
  });
}

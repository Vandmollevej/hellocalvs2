import { prisma } from "@/lib/prisma";

// Login isn't implemented yet. Until then, the scoped product trial's
// data is consolidated on a single demo user, so the UI and database use the same source.
const DEMO_USER_EMAIL = "demo@hellocal.local";

export function getDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, displayName: "Demo" },
  });
}

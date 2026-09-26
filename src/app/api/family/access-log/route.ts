import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { listWhoHasAccess } from "@/lib/family";

// Kontrol-loggen for den indloggede brugers egen profil: hvem har adgang,
// log-ins og alt, hvad andre har gjort (docs/FAMILY.md punkt 6).
// ?unseen=1 giver kun hændelser fra andre siden panelet sidst blev lukket.
export async function GET(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const unseenOnly = new URL(req.url).searchParams.get("unseen") === "1";

  const [entries, people] = await Promise.all([
    prisma.profileAccessLog.findMany({
      where: {
        subjectId: login.id,
        ...(unseenOnly
          ? {
              actorId: { not: login.id },
              ...(login.accessLogSeenAt ? { createdAt: { gt: login.accessLogSeenAt } } : {}),
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: unseenOnly ? 50 : 300,
      select: {
        id: true,
        action: true,
        area: true,
        createdAt: true,
        actor: { select: { id: true, displayName: true } },
      },
    }),
    unseenOnly ? Promise.resolve([]) : listWhoHasAccess(login.id),
  ]);

  return NextResponse.json({
    meId: login.id,
    whoHasAccess: people,
    entries: entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      area: entry.area,
      createdAt: entry.createdAt,
      actorId: entry.actor.id,
      actorName: entry.actor.displayName,
      isSelf: entry.actor.id === login.id,
    })),
  });
}

// Panelet er lukket: hændelser indtil nu er set.
export async function POST() {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  await prisma.user.update({ where: { id: login.id }, data: { accessLogSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}

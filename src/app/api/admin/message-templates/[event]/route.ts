import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import type { MessageChannel, MessageEvent as MessageEventType } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ event: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { event } = await params;

  let body: { enabled?: boolean; channel?: string; subject?: string; bodyHtml?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const data: {
    enabled?: boolean;
    channel?: MessageChannel;
    subject?: string;
    bodyHtml?: string;
  } = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.channel === "EMAIL" || body.channel === "PUSH" || body.channel === "BOTH") data.channel = body.channel;
  if (typeof body.subject === "string") data.subject = body.subject;
  if (typeof body.bodyHtml === "string") data.bodyHtml = body.bodyHtml;

  const template = await prisma.messageTemplate.update({
    where: { event: event as MessageEventType },
    data,
  });
  return NextResponse.json({ template });
}

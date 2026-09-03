import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { anonymizeUser } from "@/lib/gdpr";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await anonymizeUser(id, admin.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Kunne ikke anonymisere brugeren" },
      { status: 400 }
    );
  }
}

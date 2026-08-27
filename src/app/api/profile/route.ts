import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// PATCH /api/profile — gemmer løbende, jf. UI-princippet om ingen "Gem"-knap.
export async function PATCH(req: Request) {
  const body = await req.json();
  const { displayName, weightKg, heightCm, birthYear, sex } = body as {
    displayName?: string;
    weightKg?: number | null;
    heightCm?: number | null;
    birthYear?: number | null;
    sex?: "FEMALE" | "MALE" | null;
  };

  try {
    const user = await getDemoUser();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayName, weightKg, heightCm, birthYear, sex },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Profile update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

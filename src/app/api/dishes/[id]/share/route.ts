import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { setDishSharing } from "@/lib/shared-recipe-share";

// PATCH { shared, language } — del/stop deling af en egen ret.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { shared?: unknown; language?: unknown } | null;
  if (typeof body?.shared !== "boolean") return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  try {
    const result = await setDishSharing(user.id, id, body.shared, body.language === "en" ? "en" : "da");
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Dish sharing failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { FamilyError } from "@/lib/family";

// Fælles fejlsvar for /api/family/*: klienten oversætter `code`
// (family.error.<code> i sprogfilerne).
export function familyErrorResponse(error: unknown) {
  if (error instanceof FamilyError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  console.error("Family request failed", error);
  return NextResponse.json({ code: "unknown" }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

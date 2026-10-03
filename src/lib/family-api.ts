import { NextResponse } from "next/server";
import { FamilyError, type FamilyCodeInput } from "@/lib/family";

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

// Kode + e-mail skrevet i hånden, eller det krypterede indhold fra en QR-kode.
export function readCodeInput(body: Record<string, unknown>): FamilyCodeInput {
  if (typeof body.token === "string" && body.token) return { token: body.token };
  return {
    code: typeof body.code === "string" ? body.code : "",
    email: typeof body.email === "string" ? body.email : "",
  };
}

export function clientKey(req: Request, prefix: string) {
  return `${prefix}:${req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown"}`;
}

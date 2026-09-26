import { NextResponse } from "next/server";
import { confirmEmailVerification } from "@/lib/email-verification";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token || !(await confirmEmailVerification(token))) {
    return NextResponse.json({ message: "Linket er ugyldigt eller udløbet." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

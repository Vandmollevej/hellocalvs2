import { NextResponse, type NextRequest } from "next/server";
import { callback, resolveAdapter } from "@/lib/integrations/handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const adapter = resolveAdapter((await ctx.params).provider);
  if (!adapter) return NextResponse.json({ message: "Ukendt integration" }, { status: 404 });
  return callback(req, adapter);
}

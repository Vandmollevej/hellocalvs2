import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SCAN_SESSION_COOKIE, verifyScanSession } from "@/lib/scan/auth";

// Server-side kontrol i hver scan-route/-side ud over middleware.ts — samme
// "belt-and-suspenders"-princip som src/lib/require-admin.ts.
export async function requireScanWorker() {
  const store = await cookies();
  const token = store.get(SCAN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const workerId = await verifyScanSession(token);
  if (!workerId) return null;

  const worker = await prisma.scanWorker.findUnique({ where: { id: workerId } });
  if (!worker || worker.status !== "ACTIVE") return null;
  return worker;
}

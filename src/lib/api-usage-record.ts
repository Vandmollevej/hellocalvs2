import { prisma } from "@/lib/prisma";
import { redactSecrets } from "@/lib/api-error-explain";

// Tælling af kald til betalte API'er (admin → API-forbrug, src/lib/api-usage.ts).
// Egen lille fil, så sms/mail/places kan importere den uden resten.

export type PaidServiceId =
  | "openai"
  | "google-places"
  | "google-vision"
  | "google-search"
  | "bria"
  | "passio"
  | "sms"
  | "smtp";

export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

// Tæller ét kald til en betalt tjeneste. Må aldrig vælte eller forsinke kaldet.
export function recordApiCall(serviceId: PaidServiceId, ok: boolean, error?: string | null) {
  const now = new Date();
  const month = monthKey(now);
  const message = ok ? null : redactSecrets(error ?? "Ukendt fejl").slice(0, 300);
  void prisma.apiUsageMonth
    .upsert({
      where: { serviceId_month: { serviceId, month } },
      create: {
        serviceId,
        month,
        calls: 1,
        errors: ok ? 0 : 1,
        lastOkAt: ok ? now : null,
        lastErrorAt: ok ? null : now,
        lastError: message,
      },
      update: ok
        ? { calls: { increment: 1 }, lastOkAt: now }
        : { calls: { increment: 1 }, errors: { increment: 1 }, lastErrorAt: now, lastError: message },
    })
    .catch(() => {});
}

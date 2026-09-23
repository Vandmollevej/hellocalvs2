// Server-only: the user's time-limited Support permission (docs/DECISIONS.md
// 2026-09-23). Never import this from a client component — the client-safe
// category list is src/lib/support-permissions.ts.
//
// A SupportAccessGrant is active only when revokedAt is null and
// validFrom <= now <= validUntil. Expiry needs no job: an expired grant simply
// stops matching the queries below. The grant itself only holds categories
// and a period — never the user's data. Per docs/PRIVACY.md, Hello Cal must
// not be able to read private data server-side; the data Support gets to see
// is a package the user's own device builds from these categories and seals
// to Support's public key (privacy-vault phase, see docs/STATUS.md).

import type { SupportAccessGrant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DATE_KEY_PATTERN,
  SUPPORT_PERMISSION_KEYS,
  readSupportPermissions,
  type SupportPermissionKey,
  type SupportPermissions,
} from "@/lib/support-permissions";

// The user picks calendar days; the grant runs from the start of the Fra-day
// to the end of the Til-day in Danish time, whatever the server's timezone.
export const SUPPORT_TIME_ZONE = "Europe/Copenhagen";

function zoneOffsetMs(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SUPPORT_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// "2026-09-22" → the instant that day starts (or ends) in Europe/Copenhagen.
// Returns null for anything that isn't a real calendar date.
export function dateKeyToInstant(dateKey: string, edge: "start" | "end"): Date | null {
  if (!DATE_KEY_PATTERN.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  const wallClock =
    edge === "start" ? Date.UTC(year, month - 1, day, 0, 0, 0, 0) : Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  // Two passes so a DST switch on that very day still lands on the right hour.
  let instant = wallClock - zoneOffsetMs(new Date(wallClock));
  instant = wallClock - zoneOffsetMs(new Date(instant));
  return new Date(instant);
}

export function instantToDateKey(instant: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SUPPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function isSupportGrantActive(
  grant: Pick<SupportAccessGrant, "revokedAt" | "validFrom" | "validUntil">,
  now: Date = new Date()
) {
  return grant.revokedAt === null && grant.validFrom <= now && grant.validUntil >= now;
}

export function hasSupportPermission(
  grant: Pick<SupportAccessGrant, "revokedAt" | "validFrom" | "validUntil" | "permissions">,
  permission: SupportPermissionKey,
  now: Date = new Date()
) {
  if (!isSupportGrantActive(grant, now)) return false;
  return readSupportPermissions(grant.permissions)[permission];
}

// The user's current (active or future, not revoked, not expired) grant.
export function findCurrentSupportGrant(userId: string, now: Date = new Date()) {
  return prisma.supportAccessGrant.findFirst({
    where: { userId, revokedAt: null, validUntil: { gte: now } },
    orderBy: { updatedAt: "desc" },
  });
}

export function findActiveSupportGrant(userId: string, now: Date = new Date()) {
  return prisma.supportAccessGrant.findFirst({
    where: { userId, revokedAt: null, validFrom: { lte: now }, validUntil: { gte: now } },
    orderBy: { updatedAt: "desc" },
  });
}

export function serializeSupportGrant(grant: SupportAccessGrant) {
  return {
    id: grant.id,
    validFrom: instantToDateKey(grant.validFrom),
    validUntil: instantToDateKey(grant.validUntil),
    permissions: readSupportPermissions(grant.permissions),
    active: isSupportGrantActive(grant),
  };
}

export type SupportGrantInputError =
  | "INVALID_BODY"
  | "DATE_REQUIRED"
  | "INVALID_DATE_RANGE"
  | "UNTIL_IN_PAST"
  | "UNKNOWN_PERMISSION";

// Validates a PUT body from the settings page. Unknown permission keys are
// rejected outright, not silently dropped — nothing but the fixed category
// list (and never any security-related field) can ever be stored.
export function parseSupportGrantInput(
  body: unknown,
  now: Date = new Date()
):
  | { ok: true; validFrom: Date; validUntil: Date; permissions: SupportPermissions }
  | { ok: false; error: SupportGrantInputError; detail?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "INVALID_BODY" };
  const input = body as Record<string, unknown>;

  if (typeof input.validFrom !== "string" || typeof input.validUntil !== "string") {
    return { ok: false, error: "DATE_REQUIRED" };
  }
  const validFrom = dateKeyToInstant(input.validFrom, "start");
  const validUntil = dateKeyToInstant(input.validUntil, "end");
  if (!validFrom || !validUntil) return { ok: false, error: "DATE_REQUIRED" };
  if (validFrom > validUntil) return { ok: false, error: "INVALID_DATE_RANGE" };
  if (validUntil < now) return { ok: false, error: "UNTIL_IN_PAST" };

  const rawPermissions = input.permissions;
  if (!rawPermissions || typeof rawPermissions !== "object" || Array.isArray(rawPermissions)) {
    return { ok: false, error: "INVALID_BODY" };
  }
  for (const key of Object.keys(rawPermissions)) {
    if (!(SUPPORT_PERMISSION_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: "UNKNOWN_PERMISSION", detail: key };
    }
  }

  return { ok: true, validFrom, validUntil, permissions: readSupportPermissions(rawPermissions) };
}

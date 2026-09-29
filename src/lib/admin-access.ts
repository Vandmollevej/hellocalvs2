import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AdminLoginOutcome, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_APPROVAL_COOKIE,
  ADMIN_APPROVAL_MAX_AGE,
  ADMIN_DEVICE_COOKIE,
  ADMIN_DEVICE_MAX_AGE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  signAdminApprovalPending,
  signAdminSession,
} from "@/lib/admin-auth";
import { sendTransientMail } from "@/lib/transient-mail";

// Admin-brugere (docs/DECISIONS.md 2026-09-29): IP-begrænsning, sporing af
// login (tid, sted, udstyr) og obligatorisk godkendelse af ny enhed for
// inviterede admin-brugere.

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "https://admin.hellocal.io";
export const ADMIN_INVITE_TTL_HOURS = 24;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function adminInviteLink(token: string) {
  return `${ADMIN_BASE_URL}/admin/invite/${token}`;
}

// ---------------------------------------------------------------------------
// Forbindelsesoplysninger
// ---------------------------------------------------------------------------

export function clientIpFromHeaders(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  const raw = cf ?? headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "";
  return raw.trim().replace(/^::ffff:/, "");
}

function decodeHeader(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// "Chrome på Windows" ud fra User-Agent — bevidst grov, kun til at genkende udstyret.
export function describeDevice(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  if (!ua) return "Ukendt udstyr";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "ukendt system";
  return `${browser} på ${os}`;
}

export type RequestInfo = {
  ip: string;
  country: string | null;
  city: string | null;
  userAgent: string | null;
  deviceLabel: string;
};

// Sted kommer fra Cloudflares headers (land altid; by hvis "Add visitor
// location headers" er slået til). På LAN-forbindelser findes de ikke.
export function requestInfo(headers: Headers): RequestInfo {
  const userAgent = headers.get("user-agent");
  return {
    ip: clientIpFromHeaders(headers),
    country: headers.get("cf-ipcountry"),
    city: decodeHeader(headers.get("cf-ipcity")),
    userAgent: userAgent ? userAgent.slice(0, 300) : null,
    deviceLabel: describeDevice(userAgent),
  };
}

export function formatPlace(country: string | null | undefined, city: string | null | undefined) {
  const parts = [city, country && country !== "XX" ? country : null].filter(Boolean);
  return parts.length ? parts.join(", ") : "Ukendt sted (lokalt netværk?)";
}

// ---------------------------------------------------------------------------
// IP-begrænsning
// ---------------------------------------------------------------------------

function ipv4ToInt(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!/^\d{1,3}$/.test(part) || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

export function parseIpList(raw: string | null | undefined) {
  return (raw ?? "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// Gyldig post: "1.2.3.4", "1.2.3.0/24" eller en IPv6-adresse (kun eksakt match).
export function isValidIpEntry(entry: string) {
  const [addr, bits] = entry.split("/");
  if (addr.includes(":")) return bits === undefined && /^[0-9a-fA-F:]+$/.test(addr);
  if (ipv4ToInt(addr) === null) return false;
  return bits === undefined || (/^\d{1,2}$/.test(bits) && Number(bits) <= 32);
}

export function isIpAllowedByList(raw: string | null | undefined, ip: string) {
  const entries = parseIpList(raw);
  if (entries.length === 0) return true;
  const value = ipv4ToInt(ip);
  return entries.some((entry) => {
    const [addr, bits] = entry.split("/");
    if (bits === undefined || value === null) return addr.toLowerCase() === ip.toLowerCase();
    const base = ipv4ToInt(addr);
    if (base === null) return false;
    const size = 2 ** (32 - Number(bits));
    return Math.floor(value / size) === Math.floor(base / size);
  });
}

// ---------------------------------------------------------------------------
// Login-log
// ---------------------------------------------------------------------------

export async function logAdminLogin(userId: string, outcome: AdminLoginOutcome, method: string, info: RequestInfo) {
  await prisma.adminLoginEvent
    .create({
      data: {
        userId,
        outcome,
        method,
        ip: info.ip || null,
        country: info.country,
        city: info.city,
        userAgent: info.userAgent,
        deviceLabel: info.deviceLabel,
      },
    })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Gennemførsel af login
// ---------------------------------------------------------------------------

export function sessionCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: ADMIN_SESSION_MAX_AGE };
}

async function isInvitedAdmin(userId: string) {
  return Boolean(await prisma.adminInvite.findFirst({ where: { acceptedUserId: userId }, select: { id: true } }));
}

// Kan brugeren overhovedet logge ind fra denne forbindelse? (deaktiveret / IP)
export async function checkAdminLoginAllowed(user: User, info: RequestInfo, method: string) {
  if (user.adminDisabledAt) {
    await logAdminLogin(user.id, "DISABLED", method, info);
    return false;
  }
  if (!isIpAllowedByList(user.adminAllowedIps, info.ip)) {
    await logAdminLogin(user.id, "IP_BLOCKED", method, info);
    return false;
  }
  return true;
}

export async function readDeviceId() {
  const store = await cookies();
  const existing = store.get(ADMIN_DEVICE_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{20,64}$/.test(existing)) return { deviceId: existing, isNew: false };
  return { deviceId: randomBytes(24).toString("base64url"), isNew: true };
}

export function setDeviceCookie(response: NextResponse, deviceId: string) {
  response.cookies.set(ADMIN_DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_DEVICE_MAX_AGE,
  });
}

export async function registerDevice(userId: string, deviceId: string, info: RequestInfo) {
  await prisma.adminDevice.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    update: { lastSeenAt: new Date(), revokedAt: null, ip: info.ip || null, country: info.country, city: info.city, label: info.deviceLabel },
    create: { userId, deviceId, label: info.deviceLabel, ip: info.ip || null, country: info.country, city: info.city },
  });
}

// Sidste trin efter adgangskode+kode (eller passkey). Inviterede admin-brugere
// skal godkende en ny enhed via et link til deres egen mail, før sessionen
// udstedes; den første administrator er undtaget (ellers kan vedkommende låses
// ude uden mail). Returnerer svaret, som kalderen sender videre.
export async function finishAdminLogin(user: User, method: string, req: Request, extra?: (res: NextResponse) => void) {
  const info = requestInfo(req.headers);
  if (!(await checkAdminLoginAllowed(user, info, method))) {
    return NextResponse.json({ message: "Login er ikke tilladt fra denne forbindelse" }, { status: 403 });
  }

  const { deviceId, isNew } = await readDeviceId();
  const device = isNew
    ? null
    : await prisma.adminDevice.findUnique({ where: { userId_deviceId: { userId: user.id, deviceId } } });
  const known = Boolean(device && !device.revokedAt);

  if (!known && (await isInvitedAdmin(user.id))) {
    const token = newToken();
    const approval = await prisma.adminLoginApproval.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        deviceId,
        deviceLabel: info.deviceLabel,
        ip: info.ip || null,
        country: info.country,
        city: info.city,
        expiresAt: new Date(Date.now() + ADMIN_APPROVAL_MAX_AGE * 1000),
      },
    });
    const link = `${ADMIN_BASE_URL}/admin/login-approval/${token}`;
    try {
      await sendTransientMail({
        to: user.email,
        subject: "Godkend login til Hello Cal Admin",
        devLink: link,
        html: `<p>Hej ${escapeHtml(user.displayName)}</p>
<p>Der er forsøgt at logge ind på Hello Cal Admin fra et udstyr, vi ikke kender:</p>
<p><strong>${escapeHtml(info.deviceLabel)}</strong><br>${escapeHtml(formatPlace(info.country, info.city))}${info.ip ? ` (IP ${escapeHtml(info.ip)})` : ""}</p>
<p>Er det dig, så åbn linket og godkend. Linket virker i 15 minutter.</p>
<p><a href="${link}">${link}</a></p>
<p>Er det ikke dig, så godkend ikke, og skift din adgangskode.</p>`,
      });
    } catch {
      await prisma.adminLoginApproval.delete({ where: { id: approval.id } }).catch(() => undefined);
      return NextResponse.json({ message: "Kunne ikke sende godkendelses-mail. Kontakt administratoren." }, { status: 503 });
    }
    await logAdminLogin(user.id, "APPROVAL_SENT", method, info);
    const response = NextResponse.json({ ok: false, approvalRequired: true });
    response.cookies.set(ADMIN_APPROVAL_COOKIE, await signAdminApprovalPending(approval.id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_APPROVAL_MAX_AGE,
    });
    setDeviceCookie(response, deviceId);
    extra?.(response);
    return response;
  }

  await registerDevice(user.id, deviceId, info);
  await logAdminLogin(user.id, "SUCCESS", method, info);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, await signAdminSession(user.id, user.adminAccessLevel), sessionCookieOptions());
  setDeviceCookie(response, deviceId);
  extra?.(response);
  return response;
}

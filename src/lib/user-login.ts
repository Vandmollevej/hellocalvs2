import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueMessage } from "@/lib/messaging";
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE, signUserSession } from "@/lib/user-auth";

// Fælles afslutning på alle login-metoder (e-mail + adgangskode, Face ID/
// passkey, Google, Apple, Facebook): sætter session-cookien og genkender
// enheden. Et login fra en ny enhed eller et nyt land giver brugeren en
// advarsel på mail (docs/DECISIONS.md 2026-09-24 "Normalt login").

export type LoginMethod = "password" | "passkey" | "google" | "apple" | "facebook" | "signup";

// Tilfældigt ID pr. browser/app-installation. Kun hashen gemmes.
export const DEVICE_COOKIE = "hc_device";
const DEVICE_COOKIE_MAX_AGE = 5 * 365 * 24 * 60 * 60;

const METHOD_LABEL: Record<LoginMethod, string> = {
  password: "e-mail og adgangskode",
  passkey: "Face ID / passkey",
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  signup: "ny konto",
};

const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Land fra reverse proxy/CDN, hvis den sender det (Cloudflare: cf-ipcountry).
function requestCountry(req: Request): string | null {
  const raw = req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? "";
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1" ? code : null;
}

// Kort, læsbar enhedsbeskrivelse til mailen, fx "iPhone · Safari".
export function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Ukendt enhed";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /CriOS|Chrome\//.test(ua)
      ? "Chrome"
      : /FxiOS|Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "app";
  return `${os} · ${browser}`;
}

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Copenhagen",
  }).format(date);
}

function countryName(code: string | null) {
  if (!code) return "ukendt sted";
  try {
    return new Intl.DisplayNames(["da"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Registrerer enheden og sender en advarsel, hvis den eller landet er nyt.
// Første login nogensinde (ingen kendte enheder) giver ingen advarsel.
async function trackDevice(req: Request, userId: string, deviceId: string, method: LoginMethod) {
  const deviceHash = hash(deviceId);
  const country = requestCountry(req);
  const label = describeDevice(req.headers.get("user-agent"));
  const now = new Date();

  const known = await prisma.userKnownDevice.findMany({
    where: { userId },
    select: { deviceHash: true, country: true },
  });
  const isNewDevice = !known.some((d) => d.deviceHash === deviceHash);
  const isNewCountry = country !== null && !known.some((d) => d.country === country);

  await prisma.userKnownDevice.upsert({
    where: { userId_deviceHash: { userId, deviceHash } },
    create: { userId, deviceHash, label, country },
    update: { label, lastSeenAt: now, ...(country ? { country } : {}) },
  });

  if (known.length === 0 || method === "signup" || (!isNewDevice && !isNewCountry)) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  await queueMessage("NEW_DEVICE_LOGIN", {
    userId,
    vars: {
      displayName: user?.displayName || "",
      device: label,
      location: countryName(country),
      time: formatWhen(now),
      method: METHOD_LABEL[method],
      resetLink: `${APP_BASE_URL}/forgot-password`,
    },
  });
}

// Sætter session + enheds-cookie på et svar. Bruges af JSON-ruter og
// redirect-ruter (OAuth-callbacks).
export async function completeLogin<T extends NextResponse>(
  req: Request,
  response: T,
  userId: string,
  method: LoginMethod
): Promise<T> {
  const token = await signUserSession(userId);
  response.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
  });

  let deviceId = readCookie(req, DEVICE_COOKIE);
  if (!deviceId || deviceId.length < 16 || deviceId.length > 128) {
    deviceId = randomBytes(24).toString("base64url");
  }
  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });

  // En fejl i enhedssporing/mail må aldrig blokere selve login.
  await trackDevice(req, userId, deviceId, method).catch((error) =>
    console.error("Login device tracking failed", error)
  );
  return response;
}

import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

const ISSUER = "HELLO CAL Admin";

export function createTotpSecret() {
  return generateSecret();
}

export async function createTotpQrCode(email: string, secret: string) {
  const uri = generateURI({ issuer: ISSUER, label: email, secret });
  return QRCode.toDataURL(uri);
}

export async function verifyTotpCode(secret: string, token: string) {
  const trimmed = token.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  // ±1 time step (30s) tolerance for clock drift between server and phone.
  const result = await verify({ secret, token: trimmed, epochTolerance: [30, 30] });
  return result.valid;
}

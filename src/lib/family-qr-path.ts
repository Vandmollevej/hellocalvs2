// Familiens QR-kode er et link til /family-code/join?t=… eller
// /family-code?t=… (src/lib/family-invite-token.ts). Kun stien og token bruges,
// så et link til en anden side eller et andet domæne afvises.
export function familyPathFromQr(text: string): string | null {
  try {
    const url = new URL(text);
    const token = url.searchParams.get("t");
    if (!token || (url.pathname !== "/family-code" && url.pathname !== "/family-code/join")) return null;
    return `${url.pathname}?t=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

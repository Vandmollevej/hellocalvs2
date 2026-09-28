// Leveringsevne (docs/DECISIONS.md 2026-09-28): spamfiltre straffer mails
// uden tekstversion, uden afsender-/modtagerforklaring og uden svaradresse.
// Hver mail får derfor et fuldt HTML-dokument med fast bundtekst, en
// tekstversion og Reply-To til support (videresendes via Cloudflare).
// Bruges af både køen (mailer.ts) og direkte mails (transient-mail.ts).
export const DEFAULT_REPLY_TO = "Hello Cal <support@hellocal.io>";

const FOOTER_TEXT =
  "Du får denne mail, fordi du har en konto på Hello Cal (hellocal.io). Spørgsmål? Svar på mailen eller skriv til support@hellocal.io.";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// <a class="hc-button" href="…">Tekst</a> i en skabelon bliver til appens
// primære knap (design.md: 48 px, radius 8 px, #232323, hvid fed tekst).
// Tabel + inline styles, fordi mailprogrammer (Gmail, Outlook) fjerner CSS.
function renderEmailButtons(bodyHtml: string) {
  return bodyHtml.replace(
    /(?:<p[^>]*>\s*)?<a\s[^>]*class="hc-button"[^>]*>([\s\S]*?)<\/a>(?:\s*<\/p>)?/gi,
    (match: string, label: string) => {
      const href = /href="([^"]+)"/i.exec(match)?.[1] ?? "#";
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td align="center" bgcolor="#232323" style="border-radius:8px;background:#232323"><a href="${href}" target="_blank" style="display:inline-block;padding:12px 24px;line-height:24px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif">${label}</a></td></tr></table>`;
    }
  );
}

export function wrapEmailHtml(bodyHtml: string) {
  if (/<html[\s>]/i.test(bodyHtml)) return bodyHtml;
  return `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hello Cal</title></head><body style="margin:0;padding:24px;background:#ffffff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5"><div style="max-width:560px;margin:0 auto">${renderEmailButtons(bodyHtml)}<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px"><p style="font-size:12px;color:#6b6b6b;margin:0">${escapeHtml(FOOTER_TEXT)}</p></div></body></html>`;
}

export function htmlToText(bodyHtml: string) {
  const text = bodyHtml
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_match, href: string, label: string) => {
      const plain = label.replace(/<[^>]+>/g, "").trim();
      return plain === href ? href : `${plain} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${text}\n\n--\n${FOOTER_TEXT}`;
}

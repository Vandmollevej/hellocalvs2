// Flow-sidernes HTML (skrevet i admin → Flows) vises direkte i appen. Kun
// simple teksttags og interne/https-links overlever — ingen scripts, styles
// eller attributter i øvrigt. Kører kun i browseren (DOMParser).

const ALLOWED = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "H2", "H3", "A", "SPAN", "DIV"]);

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeHref(href: string | null): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as Element;
  const inner = Array.from(element.childNodes).map(serialize).join("");
  if (!ALLOWED.has(element.tagName)) return inner;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return "<br>";
  if (tag === "a") {
    const href = safeHref(element.getAttribute("href"));
    return href ? `<a href="${escapeText(href).replace(/"/g, "&quot;")}">${inner}</a>` : inner;
  }
  return `<${tag}>${inner}</${tag}>`;
}

export function sanitizeFlowHtml(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  return root ? Array.from(root.childNodes).map(serialize).join("") : "";
}

export function flowHtmlToText(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return "";
  return (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "").replace(/\s+/g, " ").trim();
}

// Faste mærker på admins knapper, menuer og felter, så AutoHotkey (UI
// Automation) eller en browser-automatisering kan finde dem (docs/AUTOMATION.md).
// Chrome/Edge viser et elements `id` som UIA "AutomationId" og dets navn som
// "Name"; `data-automation` har samme værdi til DOM-selectors.

export function automationProps(id: string) {
  return { id, "data-automation": id } as const;
}

// "Ønskede ingredienser" → "oenskede-ingredienser". Dansk translitteration
// først, så tegnene ikke bare forsvinder.
export function slugifyAutomation(text: string, maxLength = 40): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}

// "/admin/product-database/products" → "product-database-products";
// "/admin" → "overview".
export function pageSlug(pathname: string): string {
  const slug = slugifyAutomation(pathname.replace(/^\/admin\/?/, ""), 60);
  return slug || "overview";
}

// Menuens oversættelsesnøgle → id-del, uafhængig af sprog:
// "nav_product_database_products" → "product-database-products".
export function navSlug(key: string): string {
  return key.replace(/^nav_/, "").replace(/_/g, "-");
}

// Næste ledige navn ud fra et sæt allerede brugte: "button-gem", "button-gem-2", …
export function uniqueName(base: string, used: Set<string>): string {
  let candidate = base;
  for (let n = 2; used.has(candidate); n += 1) candidate = `${base}-${n}`;
  used.add(candidate);
  return candidate;
}

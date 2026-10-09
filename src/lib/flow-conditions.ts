// Guide-flows med betingelser (docs/DECISIONS.md 2026-10-06): hvornår et
// aktivt flow fra admin → Flows vises for en bruger. Alle udfyldte
// betingelser skal være opfyldt (OG). Tomme felter betyder "ingen grænse".
// Ren logik uden database, så den kan testes (flow-conditions.test.mjs).

export type FlowConditions = {
  /** Vis fra og med denne dato (YYYY-MM-DD). */
  startDate?: string;
  /** Vis til og med denne dato (YYYY-MM-DD). */
  endDate?: string;
  /** Kun på disse sider (sti-præfiks, fx "/calendar"). Tom = alle sider. */
  pages?: string[];
  /** Antal log-ins i alt. */
  minLogins?: number;
  maxLogins?: number;
  /** Dage siden brugeren blev oprettet. */
  minDaysSinceSignup?: number;
  maxDaysSinceSignup?: number;
  /** Dage med mindst én registrering (aktive indtastninger). */
  minActiveDays?: number;
  /** Faner/sider brugeren SKAL have besøgt (første sti-led, fx "/statistics"). */
  visited?: string[];
  /** Faner/sider brugeren IKKE må have besøgt, fx "/camera" = har ikke brugt mad-scanningen. */
  notVisited?: string[];
  /** Kun disse ugedage (0 = søndag … 6 = lørdag, dansk tid), fx [5] = fredag. Tom = alle dage. */
  weekdays?: number[];
  /** Kun fra dette klokkeslæt (hel time 0-23, dansk tid) og til (ikke inkl.) sluttimen. */
  fromHour?: number;
  toHour?: number;
  /** Mindst så mange dage mellem to visninger (når flowet må vises flere gange). */
  minDaysBetweenShows?: number;
};

export type FlowKind = "popup" | "banner";

export type FlowViewFacts = {
  shownCount: number;
  lastShownAt: Date | null;
  completedAt: Date | null;
  dismissedAt: Date | null;
};

export type FlowUserFacts = {
  now: Date;
  path: string;
  loginCount: number;
  signupAt: Date;
  activeDays: number;
  visitedSections: string[];
  view: FlowViewFacts | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Første led af stien: "/calendar/week" → "/calendar", "/" → "/". */
export function sectionOf(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  const first = clean.split("/").filter(Boolean)[0];
  return first ? `/${first}` : "/";
}

function normalizePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

export function pathMatches(path: string, prefix: string): boolean {
  if (prefix === "/") return path === "/";
  return path === prefix || path.startsWith(`${prefix}/`);
}

function cleanList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .filter((item): item is string => typeof item === "string")
    .map(normalizePath)
    .filter((item): item is string => item !== null)
    .slice(0, 30);
  return list.length ? Array.from(new Set(list)) : undefined;
}

function cleanCount(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.floor(n), 100_000);
}

function cleanWeekdays(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const days = value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length ? Array.from(new Set(days)).sort() : undefined;
}

function cleanHour(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 24 ? n : undefined;
}

function cleanDate(value: unknown): string | undefined {
  return typeof value === "string" && DATE_RE.test(value) ? value : undefined;
}

/** Saniterer betingelser fra admin-editoren / databasen. */
export function sanitizeFlowConditions(raw: unknown): FlowConditions {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: FlowConditions = {
    startDate: cleanDate(r.startDate),
    endDate: cleanDate(r.endDate),
    pages: cleanList(r.pages),
    minLogins: cleanCount(r.minLogins),
    maxLogins: cleanCount(r.maxLogins),
    minDaysSinceSignup: cleanCount(r.minDaysSinceSignup),
    maxDaysSinceSignup: cleanCount(r.maxDaysSinceSignup),
    minActiveDays: cleanCount(r.minActiveDays),
    visited: cleanList(r.visited),
    notVisited: cleanList(r.notVisited),
    weekdays: cleanWeekdays(r.weekdays),
    fromHour: cleanHour(r.fromHour),
    toHour: cleanHour(r.toHour),
    minDaysBetweenShows: cleanCount(r.minDaysBetweenShows),
  };
  for (const key of Object.keys(out) as (keyof FlowConditions)[]) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

export function sanitizeFlowKind(value: unknown): FlowKind {
  return value === "banner" ? "banner" : "popup";
}

/** YYYY-MM-DD for en dato i dansk tid (flows planlægges i dansk kalender). */
function copenhagenDay(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(date);
}

/** Ugedag (0 = søndag) og time i dansk tid. */
export function copenhagenWeekdayHour(date: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Copenhagen", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const day = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day), hour };
}

/** Skal flowet vises for brugeren lige nu? */
export function flowIsEligible(
  flow: { maxShows: number; conditions: FlowConditions },
  facts: FlowUserFacts,
): boolean {
  const c = flow.conditions;
  const view = facts.view;

  // Gennemført eller lukket med "Vis ikke igen" → aldrig igen.
  if (view?.completedAt || view?.dismissedAt) return false;
  if (flow.maxShows > 0 && (view?.shownCount ?? 0) >= flow.maxShows) return false;
  if (c.minDaysBetweenShows && view?.lastShownAt) {
    if (facts.now.getTime() - view.lastShownAt.getTime() < c.minDaysBetweenShows * DAY_MS) return false;
  }

  const today = copenhagenDay(facts.now);
  if (c.startDate && today < c.startDate) return false;
  if (c.endDate && today > c.endDate) return false;

  const { weekday, hour } = copenhagenWeekdayHour(facts.now);
  if (c.weekdays?.length && !c.weekdays.includes(weekday)) return false;
  if (c.fromHour !== undefined && hour < c.fromHour) return false;
  if (c.toHour !== undefined && hour >= c.toHour) return false;

  if (c.pages?.length && !c.pages.some((prefix) => pathMatches(facts.path, prefix))) return false;

  if (c.minLogins !== undefined && facts.loginCount < c.minLogins) return false;
  if (c.maxLogins !== undefined && facts.loginCount > c.maxLogins) return false;

  const daysSinceSignup = Math.floor((facts.now.getTime() - facts.signupAt.getTime()) / DAY_MS);
  if (c.minDaysSinceSignup !== undefined && daysSinceSignup < c.minDaysSinceSignup) return false;
  if (c.maxDaysSinceSignup !== undefined && daysSinceSignup > c.maxDaysSinceSignup) return false;

  if (c.minActiveDays !== undefined && facts.activeDays < c.minActiveDays) return false;

  const visited = new Set(facts.visitedSections);
  if (c.visited?.some((section) => !visited.has(sectionOf(section)))) return false;
  if (c.notVisited?.some((section) => visited.has(sectionOf(section)))) return false;

  return true;
}

/** Kun interne stier må bruges som knap-link i et flow. */
export function sanitizeActionHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.length > 300) return null;
  return trimmed;
}

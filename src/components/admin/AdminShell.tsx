"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@prisma/client";
import { t, type AdminI18nKey } from "@/lib/admin-i18n";
import { AdminCountryDialog, readAdminCountry } from "@/components/admin/AdminCountryDialog";
import { AutomationMarkers } from "@/components/admin/AutomationMarkers";
import { useAdminShortcuts } from "@/components/admin/useAdminShortcuts";
import { formatCombo, shortcutsForHref } from "@/lib/admin-shortcuts";
import { automationProps, navSlug } from "@/lib/automation-markers";

// Admin-skal efter Cloudflare-dashboardets struktur (docs/DECISIONS.md
// 2026-09-27): venstre sidebjælke i fuld højde med logo, "Gå til…"-søgning
// og sammenfoldelige grupper med ikoner; topbar over indholdet med
// brødkrummer og brugermenu. Under lg bliver sidebjælken en skuffe bag en menuknap.
// Farverne er de eksisterende Hello Cal-tokens.

type IconName = "home" | "chart" | "box" | "database" | "users" | "handshake" | "shield" | "cog" | "palette" | "road" | "flow" | "pot" | "log" | "plug" | "coin";
export type NavLink = { href: string; key: AdminI18nKey; alsoActive?: string[] };
export type NavEntry =
  | { kind: "link"; href: string; key: AdminI18nKey; icon: IconName }
  | { kind: "group"; id: string; key: AdminI18nKey; icon: IconName; links: NavLink[] };

// Menustrukturen er brugerens (docs/DECISIONS.md 2026-09-27, "Admin-menuens
// grupper"). Sider brugeren ikke nævnte (Nye produkter, Logoer,
// Søgealgoritmer) er lagt i den gruppe de hører til. Hver side skal have en
// genvej i src/lib/admin-shortcuts.ts (kontrolleres af `npm test`); Genveje-
// siden læser denne liste.
export const NAV: NavEntry[] = [
  { kind: "link", href: "/admin", key: "nav_overview", icon: "home" },
  {
    kind: "group",
    id: "approval",
    key: "nav_group_approval",
    icon: "box",
    links: [
      { href: "/admin/quality-control", key: "nav_quality_control" },
      { href: "/admin/uncertainties", key: "nav_uncertainties" },
      { href: "/admin/duplicate-products", key: "nav_duplicate_products" },
      { href: "/admin/ingredient-requests", key: "nav_ingredient_requests" },
      { href: "/admin/images", key: "nav_images", alsoActive: ["/admin/logos"] },
      { href: "/admin/products", key: "nav_products" },
    ],
  },
  {
    kind: "group",
    id: "product-database",
    key: "nav_product_database",
    icon: "database",
    links: [
      { href: "/admin/product-database/products", key: "nav_product_database_products" },
      { href: "/admin/product-database/brands", key: "nav_product_database_brands" },
      { href: "/admin/product-database/images", key: "nav_product_database_images" },
    ],
  },
  // Retter (docs/DECISIONS.md 2026-09-28): opskrifter er ikke produkter og
  // står derfor ikke i Produkt-database.
  {
    kind: "group",
    id: "dishes",
    key: "nav_group_dishes",
    icon: "pot",
    links: [
      { href: "/admin/dishes/user", key: "nav_dishes_user" },
      { href: "/admin/dishes/hellofresh", key: "nav_dishes_hellofresh" },
      { href: "/admin/dishes/valdemarsro", key: "nav_dishes_valdemarsro" },
    ],
  },
  // Flows (docs/DECISIONS.md 2026-09-27): egne flow-sider og
  // Guide-builderen (startup-guide + tooltip-popups).
  {
    kind: "group",
    id: "flows",
    key: "nav_group_flows",
    icon: "flow",
    links: [
      { href: "/admin/flows", key: "nav_flow_pages" },
      { href: "/admin/guide-builder", key: "nav_guide_builder" },
    ],
  },
  {
    kind: "group",
    id: "design",
    key: "nav_group_design",
    icon: "palette",
    links: [
      { href: "/admin/designmanual", key: "nav_design_manual" },
      { href: "/admin/page-tree", key: "nav_page_tree" },
    ],
  },
  // Analyse (docs/DECISIONS.md 2026-10-10): statistik og søgestatistik.
  {
    kind: "group",
    id: "analysis",
    key: "nav_analytics",
    icon: "chart",
    links: [
      { href: "/admin/statistics", key: "nav_statistics" },
      { href: "/admin/statistics/search", key: "nav_search_analytics" },
    ],
  },
  { kind: "link", href: "/admin/integrations", key: "nav_integrations", icon: "plug" },
  { kind: "link", href: "/admin/economy", key: "nav_economy", icon: "coin" },
  { kind: "link", href: "/admin/hello-doc", key: "nav_hello_doc", icon: "users" },
  {
    kind: "group",
    id: "people",
    key: "nav_group_people",
    icon: "users",
    links: [
      { href: "/admin/users", key: "nav_users_all" },
      { href: "/admin/users/points", key: "nav_grant_points" },
      { href: "/admin/chatbot", key: "nav_chatbot" },
      { href: "/admin/users/personas", key: "nav_personas" },
      { href: "/admin/test-programmes", key: "nav_test_programmes" },
      { href: "/admin/bug-reports", key: "nav_bug_reports" },
      { href: "/admin/support", key: "nav_support" },
    ],
  },
  {
    kind: "group",
    id: "settings",
    key: "nav_group_settings",
    icon: "cog",
    links: [
      { href: "/admin/api-keys", key: "nav_api_keys" },
      { href: "/admin/cron-jobs", key: "nav_cron_jobs" },
      { href: "/admin/pet-food-filter", key: "nav_pet_food_filter" },
      { href: "/admin/passkeys", key: "nav_passkeys" },
      { href: "/admin/support/templates", key: "nav_standard_mails" },
      { href: "/admin/messaging", key: "nav_messaging" },
      { href: "/admin/search-ranking", key: "nav_search_ranking" },
      { href: "/admin/search-synonyms", key: "nav_search_synonyms" },
      { href: "/admin/weight-attire", key: "nav_weight_attire" },
      { href: "/admin/shortcuts", key: "nav_shortcuts" },
    ],
  },
  {
    kind: "group",
    id: "administration",
    key: "nav_group_administration",
    icon: "shield",
    links: [
      { href: "/admin/scan-invites", key: "nav_scan_invites" },
      { href: "/admin/scan-invites/afvisningsaarsager", key: "nav_rejection_reasons" },
      { href: "/admin/jobs", key: "nav_jobs" },
      { href: "/admin/agents", key: "nav_agents" },
      { href: "/admin/robots", key: "nav_robots" },
      { href: "/admin/admin-users", key: "nav_admin_users" },
    ],
  },
  {
    kind: "group",
    id: "partners",
    key: "nav_partners",
    icon: "handshake",
    links: [
      { href: "/admin/partners/ads", key: "nav_partners_ads" },
      { href: "/admin/partners/contacts", key: "nav_partners_contacts" },
      { href: "/admin/partners/users", key: "nav_partners_users" },
      { href: "/admin/partners/reports", key: "nav_reports" },
    ],
  },
  {
    kind: "group",
    id: "roadmap",
    key: "nav_group_roadmap",
    icon: "road",
    links: [
      { href: "/admin/roadmap", key: "nav_roadmap" },
      { href: "/admin/claude", key: "nav_claude" },
    ],
  },
  // Test-log indtil appen går live (docs/DECISIONS.md 2026-09-28).
  { kind: "link", href: "/admin/log", key: "nav_log", icon: "log" },
];

const OPEN_GROUPS_KEY = "hc-admin-open-groups";
const COLLAPSED_KEY = "hc-admin-sidebar-collapsed";

const ALL_HREFS = NAV.flatMap((entry) => (entry.kind === "link" ? [entry.href] : entry.links.map((link) => link.href)));

function matches(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Kun det længste match er aktivt, så /admin/support/templates markerer
// "Standard-mails" og ikke også "Beskeder".
const ALSO_ACTIVE: Record<string, string[]> = Object.fromEntries(
  NAV.flatMap((entry) => (entry.kind === "group" ? entry.links : [])).flatMap((link) => (link.alsoActive ? [[link.href, link.alsoActive]] : [])),
);

function isActive(pathname: string, href: string) {
  if (ALSO_ACTIVE[href]?.some((extra) => matches(pathname, extra))) return true;
  if (!matches(pathname, href)) return false;
  return !ALL_HREFS.some((other) => other.length > href.length && matches(pathname, other));
}

function activeGroupId(pathname: string) {
  for (const entry of NAV) {
    if (entry.kind === "group" && entry.links.some((link) => isActive(pathname, link.href))) return entry.id;
  }
  return null;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Privat vindue o.l. — valget huskes bare ikke.
  }
}

function Icon({ name, className = "h-5 w-5" }: { name: IconName | "search" | "chevron" | "menu" | "close" | "collapse"; className?: string }) {
  const paths: Record<typeof name, React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    box: (
      <>
        <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
        <path d="M3 8l9 5 9-5M12 13v8" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
        <path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
      </>
    ),
    handshake: <path d="m11 17 2 2a1.4 1.4 0 0 0 2-2m-2-2 2.5 2.5a1.4 1.4 0 0 0 2-2L14 12l-2 1.5a2 2 0 0 1-2.5-3L12 8h3l4 4M3 12l4-4h3M3 12l3 3m0 0 2 2a1.4 1.4 0 0 0 2-2m-4 0 1-1M21 12l-2 0" />,
    shield: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />,
    cog: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </>
    ),
    palette: (
      <>
        <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z" />
        <circle cx="7.5" cy="11.5" r="1" />
        <circle cx="10.5" cy="7.5" r="1" />
        <circle cx="15" cy="8" r="1" />
      </>
    ),
    road: <path d="M5 21 9 3M19 21 15 3M12 4v2.5M12 10.5v3M12 17.5V20" />,
    plug: <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />,
    coin: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5" />
      </>
    ),
    log: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    pot: (
      <>
        <path d="M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5zM2 11h2M20 11h2M8 8h8" />
        <path d="M9 5c0-1 1-1 1-2M14 5c0-1 1-1 1-2" />
      </>
    ),
    flow: (
      <>
        <rect x="3" y="3.5" width="7" height="5" rx="1.5" />
        <rect x="14" y="15.5" width="7" height="5" rx="1.5" />
        <path d="M6.5 8.5v4a2 2 0 0 0 2 2h9v1M15 12.5l2.5 2 -2.5 2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    collapse: <path d="m15 6-6 6 6 6" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

type Badges = { support: { unanswered: number; overdue: number } | null; uncertainties: boolean };

function LinkBadge({ href, badges }: { href: string; badges: Badges }) {
  if (href === "/admin/uncertainties" && badges.uncertainties) {
    return <span aria-label="Usikre varer" className="hf-navrow__dot" />;
  }
  if (href === "/admin/support" && badges.support && badges.support.unanswered > 0) {
    return (
      <span
        className={`hf-type-small hf-type-strong shrink-0 rounded-full px-1.5 ${
          badges.support.overdue > 0 ? "bg-hf-red-dark text-hf-white" : "bg-hf-tan text-hf-black"
        }`}
      >
        {badges.support.unanswered}
      </span>
    );
  }
  return null;
}

function groupHasBadge(links: NavLink[], badges: Badges) {
  return links.some(
    (link) =>
      (link.href === "/admin/uncertainties" && badges.uncertainties) ||
      (link.href === "/admin/support" && (badges.support?.unanswered ?? 0) > 0),
  );
}

// Genvejen vises kun i hurtigsøgningen (ikke som
// aria-keyshortcuts) og aldrig ved mouse over i sidebjælken.
function shortcutHint(href: string) {
  const combo = shortcutsForHref(href)[0];
  return combo ? formatCombo(combo) : undefined;
}

// Faste id'er til automatisering (docs/AUTOMATION.md): prefix er "hc-nav" i
// sidebjælken og "hc-drawer-nav" i skuffen, så de to ikke deler id.
function SidebarNav({
  locale,
  pathname,
  badges,
  collapsed,
  openGroups,
  toggleGroup,
  idPrefix,
}: {
  locale: Locale;
  pathname: string;
  badges: Badges;
  collapsed: boolean;
  openGroups: Set<string>;
  toggleGroup: (id: string) => void;
  idPrefix: string;
}) {
  return (
    <ul className="hf-shell__list">
      {NAV.map((entry) => {
        if (entry.kind === "link") {
          const active = isActive(pathname, entry.href);
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                title={collapsed ? t(locale, entry.key) : undefined}
                aria-current={active ? "page" : undefined}
                {...automationProps(`${idPrefix}-${navSlug(entry.key)}`)}
                className={`hf-navrow ${collapsed ? "hf-navrow--rail" : ""}`}
              >
                <Icon name={entry.icon} />
                {!collapsed && <span className="hf-navrow__label">{t(locale, entry.key)}</span>}
              </Link>
            </li>
          );
        }

        const groupActive = entry.links.some((link) => isActive(pathname, link.href));
        const badge = groupHasBadge(entry.links, badges);

        if (collapsed) {
          // Ikon-skinne: gruppen peger på sin første side, som i Cloudflares
          // sammenklappede sidebjælke.
          return (
            <li key={entry.id}>
              <Link
                href={entry.links[0].href}
                title={t(locale, entry.key)}
                {...automationProps(`${idPrefix}-group-${entry.id}`)}
                className={`hf-navrow hf-navrow--rail ${groupActive ? "is-active" : ""}`}
              >
                <Icon name={entry.icon} />
                {badge && <span className="hf-navrow__dot" />}
              </Link>
            </li>
          );
        }

        const open = openGroups.has(entry.id);
        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => toggleGroup(entry.id)}
              aria-expanded={open}
              {...automationProps(`${idPrefix}-group-${entry.id}`)}
              className={`hf-navrow ${groupActive && !open ? "is-active" : ""}`}
            >
              <Icon name={entry.icon} />
              <span className="hf-navrow__label">{t(locale, entry.key)}</span>
              {badge && !open && <span className="hf-navrow__dot" />}
              <Icon
                name="chevron"
                className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <ul className="hf-shell__list hf-shell__list--sub">
                {entry.links.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        {...automationProps(`${idPrefix}-${navSlug(link.key)}`)}
                        className="hf-navrow hf-navrow--sub"
                      >
                        <span className="hf-navrow__label">{t(locale, link.key)}</span>
                        <LinkBadge href={link.href} badges={badges} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function QuickSearch({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const items = useMemo(() => {
    const all: { href: string; slug: string; label: string; section: string | null }[] = [];
    for (const entry of NAV) {
      if (entry.kind === "link") {
        all.push({ href: entry.href, slug: navSlug(entry.key), label: t(locale, entry.key), section: null });
      } else {
        for (const link of entry.links) {
          all.push({ href: link.href, slug: navSlug(link.key), label: t(locale, link.key), section: t(locale, entry.key) });
        }
      }
    }
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) => `${item.label} ${item.section ?? ""}`.toLowerCase().includes(q));
  }, [locale, query]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="hf-shell__palette" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(locale, "nav_quick_search")}
        {...automationProps("hc-quick-search")}
        className="hf-menu hf-shell__palette-box"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hf-tan-dark px-3">
          <Icon name="search" className="h-4 w-4 text-text-muted" />
          <input
            autoFocus
            {...automationProps("hc-quick-search-input")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              else if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && items[index]) go(items[index].href);
            }}
            placeholder={t(locale, "nav_quick_search")}
            className="hf-type-body h-12 w-full bg-transparent text-hf-black outline-none placeholder:text-text-muted"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <li className="hf-type-body px-3 py-4 text-text-muted">{t(locale, "nav_quick_search_empty")}</li>
          )}
          {items.map((item, i) => (
            <li key={item.href}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item.href)}
                {...automationProps(`hc-quick-search-${item.slug}`)}
                className={`hf-navrow ${i === index ? "bg-hf-tan text-hf-black" : ""}`}
              >
                <span className="hf-navrow__label">{item.label}</span>
                {item.section && <span className="hf-type-small text-text-muted">{item.section}</span>}
                {shortcutHint(item.href) && <kbd className="hf-kbd">{shortcutHint(item.href)}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function UserMenu({
  email,
  locale,
  onLocale,
  onLogout,
  canManageAdmins,
  newAdminSignups,
}: {
  email: string;
  locale: Locale;
  onLocale: (next: Locale) => void;
  onLogout: () => void;
  canManageAdmins: boolean;
  newAdminSignups: number;
}) {
  const [open, setOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [country, setCountry] = useState(locale === "DA" ? "denmark" : "united-kingdom");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setCountry(readAdminCountry(locale));
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-label={email}
        {...automationProps("hc-user-menu")}
        className="hf-type-body hf-type-strong relative flex h-8 w-8 items-center justify-center rounded-full bg-hf-green-dark uppercase text-hf-white"
      >
        {email.charAt(0)}
        {newAdminSignups > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-hf-white bg-hf-red-dark" />
        )}
      </button>
      {open && (
        <div className="hf-menu absolute right-0 top-10 w-64">
          <div className="hf-menu__header">
            <p className="hf-type-small text-text-muted">{t(locale, "nav_signed_in_as")}</p>
            <p className="hf-type-body truncate text-hf-black">{email}</p>
          </div>
          {canManageAdmins && (
            <Link
              href="/admin/admin-users"
              onClick={() => setOpen(false)}
              {...automationProps("hc-user-menu-admin-users")}
              className="hf-navrow"
            >
              <span className="hf-navrow__label">{t(locale, "nav_admin_users")}</span>
              {newAdminSignups > 0 && (
                <span className="hf-type-small rounded-full bg-hf-red-dark px-1.5 text-hf-white">{newAdminSignups}</span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCountryOpen(true);
            }}
            {...automationProps("hc-user-menu-language")}
            className="hf-navrow"
          >
            <span className="hf-navrow__label">{t(locale, "nav_language_name")}</span>
            <Image src={`/flags/${country}.png`} alt="" width={24} height={18} className="rounded-[2px]" />
            <Icon name="chevron" className="h-4 w-4" />
          </button>
          <button type="button" onClick={onLogout} {...automationProps("hc-user-menu-logout")} className="hf-navrow">
            {t(locale, "nav_logout")}
          </button>
        </div>
      )}
      {countryOpen && (
        <AdminCountryDialog
          locale={locale}
          selected={country}
          onClose={() => setCountryOpen(false)}
          onSelect={(flag, next) => {
            setCountry(flag);
            setCountryOpen(false);
            onLocale(next);
          }}
        />
      )}
    </div>
  );
}

function SearchField({
  label,
  collapsed,
  onOpen,
  id,
}: {
  label: string;
  collapsed: boolean;
  onOpen: () => void;
  id: string;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onOpen}
        title={label}
        aria-label={label}
        {...automationProps(id)}
        className="hf-shell__search hf-shell__search--rail"
      >
        <Icon name="search" className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      {...automationProps(id)}
      className="hf-shell__search"
    >
      <Icon name="search" className="h-4 w-4" />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

// Partnersiderne (/admin/partners/<id>, docs/DECISIONS.md 2026-10-02) har
// egen venstre bjælke med virksomhedsoplysninger og intet søgefelt.
// Hold i takt med faste mapper under src/app/admin/partners/.
const PARTNER_SUBPAGES = new Set(["ads", "contacts", "reports", "users"]);
export function isPartnerDetailPath(pathname: string) {
  const match = pathname.match(/^\/admin\/partners\/([^/]+)/);
  return !!match && !PARTNER_SUBPAGES.has(match[1]);
}

function Breadcrumbs({ locale, pathname }: { locale: Locale; pathname: string }) {
  const crumbs: { label: string; href?: string }[] = [{ label: "Admin", href: "/admin" }];
  if (isPartnerDetailPath(pathname)) {
    crumbs.push({ label: t(locale, "nav_partners"), href: "/admin/partners/contacts" });
    crumbs.push({ label: t(locale, "nav_partner_page") });
  }
  for (const entry of NAV) {
    if (entry.kind === "link") {
      if (entry.href !== "/admin" && isActive(pathname, entry.href)) crumbs.push({ label: t(locale, entry.key) });
      continue;
    }
    const link = entry.links.find((candidate) => isActive(pathname, candidate.href));
    if (link) {
      crumbs.push({ label: t(locale, entry.key) });
      // Undersider (fx et enkelt produkt) linker tilbage til listen.
      crumbs.push({ label: t(locale, link.key), href: pathname === link.href ? undefined : link.href });
    }
  }
  if (pathname === "/admin") crumbs.push({ label: t(locale, "nav_overview") });
  if (matches(pathname, "/admin/admin-users")) crumbs.push({ label: t(locale, "nav_admin_users") });

  return (
    <nav aria-label="Breadcrumb" {...automationProps("hc-breadcrumbs")} className="hf-crumbs max-sm:hidden">
      {crumbs.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="hf-crumbs__item">
          {i > 0 && <span aria-hidden="true">/</span>}
          {crumb.href ? (
            <Link href={crumb.href}>{crumb.label}</Link>
          ) : (
            <span className={i === crumbs.length - 1 ? "hf-crumbs__current" : ""}>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function AdminShell({
  email,
  locale,
  hasOpenUncertainties = false,
  canManageAdmins = false,
  newAdminSignups = 0,
  children,
}: {
  email: string;
  locale: Locale;
  hasOpenUncertainties?: boolean;
  canManageAdmins?: boolean;
  newAdminSignups?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState(locale);
  // Supporttæller: ubesvarede sager, rød ved sager over 24 timer
  // (docs/DECISIONS.md 2026-09-26). Hentes igen ved hvert sideskift.
  const [support, setSupport] = useState<Badges["support"]>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = activeGroupId(pathname);
    return new Set(initial ? [initial] : []);
  });

  // Husk åbne grupper og sammenklappet sidebjælke (kun bekvemmelighed).
  useEffect(() => {
    const stored = readStorage(OPEN_GROUPS_KEY);
    const storedCollapsed = readStorage(COLLAPSED_KEY) === "1";
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage findes først efter hydrering */
    if (stored) {
      setOpenGroups((current) => new Set([...current, ...stored.split(",").filter(Boolean)]));
    }
    setCollapsed(storedCollapsed);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const groupId = activeGroupId(pathname);
    /* eslint-disable react-hooks/set-state-in-effect -- følger ruteskift */
    if (groupId) setOpenGroups((current) => (current.has(groupId) ? current : new Set([...current, groupId])));
    setDrawerOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch("/api/admin/support/count", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSupport(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tastaturgenveje (Ctrl+K, Ctrl+B og sider, se src/lib/admin-shortcuts.ts).
  useAdminShortcuts({
    canManageAdmins,
    onQuickSearch: () => setSearchOpen((value) => !value),
    onToggleSidebar: () => {
      // Under 1024 px findes sidebjælken kun som skuffe.
      if (window.matchMedia("(max-width: 1023px)").matches) setDrawerOpen((value) => !value);
      else toggleCollapsed();
    },
    onNavigate: (href) => {
      setSearchOpen(false);
      setDrawerOpen(false);
      if (href !== pathname) router.push(href);
    },
  });

  // html/body er låst mod scroll globalt (globals.css), så admin scroller i
  // sin egen rod-container. Skuffen låser derfor den container, ikke body.
  const scrollRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!drawerOpen) return;
    const root = scrollRootRef.current;
    if (!root) return;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [drawerOpen]);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeStorage(OPEN_GROUPS_KEY, [...next].join(","));
      return next;
    });
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      writeStorage(COLLAPSED_KEY, value ? "0" : "1");
      return !value;
    });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function changeLocale(next: Locale) {
    setCurrentLocale(next);
    await fetch("/api/admin/locale", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
  }

  const badges: Badges = { support, uncertainties: hasOpenUncertainties };

  const searchLabel = t(currentLocale, "nav_quick_search");
  const hideSearch = isPartnerDetailPath(pathname);

  return (
    <div ref={scrollRootRef} className="hf-shell">
      {/* Sidebjælken går i ét stykke fra top til bund (som Cloudflare): logo
          og "Gå til…"-søgning ligger øverst i kolonnen, ikke i topbaren.
          Fælles skal-klasser med webvisningen (globals.css, design.md §6.17). */}
      <aside className={`hf-shell__sidebar ${collapsed ? "is-collapsed" : ""}`}>
        <div className="hf-shell__brand">
          <Link
            href="/admin"
            className="flex items-center"
            title={collapsed ? "Hello Cal Admin" : undefined}
            {...automationProps("hc-sidebar-logo")}
          >
            <Image
              src="/hello-cal-logo.png"
              alt="Hello Cal"
              width={collapsed ? 44 : 90}
              height={collapsed ? 20 : 40}
              priority
            />
          </Link>
        </div>
        {!hideSearch && (
          <div className="hf-shell__search-slot">
            <SearchField
              id="hc-sidebar-search"
              label={searchLabel}
              collapsed={collapsed}
              onOpen={() => setSearchOpen(true)}
            />
          </div>
        )}
        <nav className="hf-shell__nav" aria-label="Admin" {...automationProps("hc-sidebar-nav")}>
          <SidebarNav
            idPrefix="hc-nav"
            locale={currentLocale}
            pathname={pathname}
            badges={badges}
            collapsed={collapsed}
            openGroups={openGroups}
            toggleGroup={toggleGroup}
          />
        </nav>
        {/* Sammenfold-ikonet hænger på sidebjælkens kant, inde i hovedsiden,
            så det altid er synligt — også når sidebjælken er minimeret. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={t(currentLocale, collapsed ? "nav_expand" : "nav_collapse")}
          aria-label={t(currentLocale, collapsed ? "nav_expand" : "nav_collapse")}
          {...automationProps("hc-sidebar-toggle")}
          className="hf-shell__handle"
        />
      </aside>

      <div className="hf-shell__body">
        <header className="hf-shell__topbar">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t(currentLocale, "nav_open_menu")}
            {...automationProps("hc-topbar-menu")}
            className="hf-btn-icon hf-shell__mobile-only text-text-secondary hover:bg-hf-tan"
          >
            <Icon name="menu" />
          </button>
          <Link href="/admin" className="hf-shell__mobile-only shrink-0 items-center" {...automationProps("hc-topbar-logo")}>
            <Image src="/hello-cal-logo.png" alt="Hello Cal" width={90} height={40} priority />
          </Link>
          <Breadcrumbs locale={currentLocale} pathname={pathname} />
          {!hideSearch && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={searchLabel}
              {...automationProps("hc-topbar-search")}
              className="hf-btn-icon hf-shell__mobile-only ml-auto text-text-secondary hover:bg-hf-tan"
            >
              <Icon name="search" />
            </button>
          )}
          <div className="ml-auto">
            <UserMenu
              email={email}
              locale={currentLocale}
              onLocale={changeLocale}
              onLogout={logout}
              canManageAdmins={canManageAdmins}
              newAdminSignups={newAdminSignups}
            />
          </div>
        </header>

        <main className="hf-shell__main admin-main" {...automationProps("hc-main")}>
          <div className="hf-shell__content">{children}</div>
        </main>
      </div>

      {drawerOpen && (
        <div className="hf-shell__drawer">
          <div className="hf-shell__drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="hf-shell__drawer-panel">
            <div className="hf-shell__brand">
              <Image src="/hello-cal-logo.png" alt="Hello Cal" width={90} height={40} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t(currentLocale, "nav_close_menu")}
                {...automationProps("hc-drawer-close")}
                className="hf-btn-icon text-text-secondary hover:bg-hf-tan"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="hf-shell__search-slot">
              <SearchField
                id="hc-drawer-search"
                label={searchLabel}
                collapsed={false}
                onOpen={() => {
                  setDrawerOpen(false);
                  setSearchOpen(true);
                }}
              />
            </div>
            <nav className="hf-shell__nav" aria-label="Admin" {...automationProps("hc-drawer-nav")}>
              <SidebarNav
                idPrefix="hc-drawer-nav"
                locale={currentLocale}
                pathname={pathname}
                badges={badges}
                collapsed={false}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
              />
            </nav>
            <p className="hf-shell__drawer-foot hf-type-small truncate text-text-muted">{email}</p>
          </aside>
        </div>
      )}

      {searchOpen && <QuickSearch locale={currentLocale} onClose={() => setSearchOpen(false)} />}
      <AutomationMarkers />
    </div>
  );
}

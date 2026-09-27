"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@prisma/client";
import { t, type AdminI18nKey } from "@/lib/admin-i18n";

// Admin-skal efter Cloudflare-dashboardets struktur (docs/DECISIONS.md
// 2026-09-27): fast topbar (logo, "Gå til…"-søgning, brugermenu), venstre
// sidebjælke med sammenfoldelige grupper og ikoner, brødkrummer over
// indholdet. Under lg bliver sidebjælken en skuffe bag en menuknap.
// Farverne er de eksisterende Hello Cal-tokens.

type IconName = "home" | "box" | "users" | "search" | "shield" | "clock";
type NavLink = { href: string; key: AdminI18nKey };
type NavEntry =
  | { kind: "link"; href: string; key: AdminI18nKey; icon: IconName }
  | { kind: "group"; id: string; key: AdminI18nKey; icon: IconName; links: NavLink[] };

const NAV: NavEntry[] = [
  { kind: "link", href: "/admin", key: "nav_overview", icon: "home" },
  {
    kind: "group",
    id: "products",
    key: "nav_group_products",
    icon: "box",
    links: [
      { href: "/admin/products", key: "nav_products" },
      { href: "/admin/images", key: "nav_images" },
      { href: "/admin/logos", key: "nav_logos" },
      { href: "/admin/quality-control", key: "nav_quality_control" },
      { href: "/admin/uncertainties", key: "nav_uncertainties" },
      { href: "/admin/duplicate-products", key: "nav_duplicate_products" },
      { href: "/admin/ingredient-requests", key: "nav_ingredient_requests" },
    ],
  },
  {
    kind: "group",
    id: "people",
    key: "nav_group_people",
    icon: "users",
    links: [
      { href: "/admin/users", key: "nav_users" },
      { href: "/admin/support", key: "nav_support" },
      { href: "/admin/bug-reports", key: "nav_bug_reports" },
      { href: "/admin/messaging", key: "nav_messaging" },
      { href: "/admin/scan-invites", key: "nav_scan_invites" },
    ],
  },
  {
    kind: "group",
    id: "search",
    key: "nav_group_search",
    icon: "search",
    links: [
      { href: "/admin/search", key: "nav_search" },
      { href: "/admin/search-ranking", key: "nav_search_ranking" },
    ],
  },
  {
    kind: "group",
    id: "security",
    key: "nav_group_security",
    icon: "shield",
    links: [
      { href: "/admin/passkeys", key: "nav_passkeys" },
      { href: "/admin/api-keys", key: "nav_api_keys" },
    ],
  },
  {
    kind: "group",
    id: "system",
    key: "nav_group_system",
    icon: "clock",
    links: [
      { href: "/admin/cron-jobs", key: "nav_cron_jobs" },
      { href: "/admin/designmanual", key: "nav_design_manual" },
    ],
  },
];

const OPEN_GROUPS_KEY = "hc-admin-open-groups";
const COLLAPSED_KEY = "hc-admin-sidebar-collapsed";

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
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

function Icon({ name, className = "h-5 w-5" }: { name: IconName | "chevron" | "menu" | "close" | "collapse"; className?: string }) {
  const paths: Record<typeof name, React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
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
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
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
    return <span aria-label="Usikre produkter" className="ml-auto h-2 w-2 shrink-0 rounded-full bg-hf-red-dark" />;
  }
  if (href === "/admin/support" && badges.support && badges.support.unanswered > 0) {
    return (
      <span
        className={`ml-auto shrink-0 rounded-full px-1.5 text-xs font-medium ${
          badges.support.overdue > 0 ? "bg-hf-red-dark text-hf-white" : "bg-hf-tan text-text-primary"
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

function SidebarNav({
  locale,
  pathname,
  badges,
  collapsed,
  openGroups,
  toggleGroup,
}: {
  locale: Locale;
  pathname: string;
  badges: Badges;
  collapsed: boolean;
  openGroups: Set<string>;
  toggleGroup: (id: string) => void;
}) {
  const rowBase = "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm";
  const rowIdle = "text-text-secondary hover:bg-hf-tan hover:text-text-primary";
  const rowActive = "bg-hf-tan font-medium text-hf-green-dark";

  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((entry) => {
        if (entry.kind === "link") {
          const active = isActive(pathname, entry.href);
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                title={collapsed ? t(locale, entry.key) : undefined}
                aria-current={active ? "page" : undefined}
                className={`${rowBase} ${active ? rowActive : rowIdle} ${collapsed ? "justify-center" : ""}`}
              >
                <Icon name={entry.icon} />
                {!collapsed && <span className="truncate">{t(locale, entry.key)}</span>}
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
                className={`${rowBase} relative justify-center ${groupActive ? rowActive : rowIdle}`}
              >
                <Icon name={entry.icon} />
                {badge && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-hf-red-dark" />}
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
              className={`${rowBase} ${groupActive && !open ? rowActive : rowIdle}`}
            >
              <Icon name={entry.icon} />
              <span className="truncate">{t(locale, entry.key)}</span>
              {badge && !open && <span className="h-2 w-2 shrink-0 rounded-full bg-hf-red-dark" />}
              <Icon
                name="chevron"
                className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                {entry.links.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-md py-1.5 pl-10 pr-2.5 text-sm ${
                          active ? rowActive : rowIdle
                        }`}
                      >
                        <span className="truncate">{t(locale, link.key)}</span>
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
    const all: { href: string; label: string; section: string | null }[] = [];
    for (const entry of NAV) {
      if (entry.kind === "link") all.push({ href: entry.href, label: t(locale, entry.key), section: null });
      else for (const link of entry.links) all.push({ href: link.href, label: t(locale, link.key), section: t(locale, entry.key) });
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border-strong bg-surface-2 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border-strong px-3">
          <Icon name="search" className="h-4 w-4 text-text-muted" />
          <input
            autoFocus
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
            className="h-12 w-full bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <li className="px-3 py-4 text-sm text-text-muted">{t(locale, "nav_quick_search_empty")}</li>
          )}
          {items.map((item, i) => (
            <li key={item.href}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item.href)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${
                  i === index ? "bg-hf-tan text-text-primary" : "text-text-secondary"
                }`}
              >
                <span>{item.label}</span>
                {item.section && <span className="text-xs text-text-muted">{item.section}</span>}
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
}: {
  email: string;
  locale: Locale;
  onLocale: (next: Locale) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
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
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={email}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-green-dark text-sm font-semibold uppercase text-hf-white"
      >
        {email.charAt(0)}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-lg border border-border-strong bg-surface-2 p-1.5 shadow-lg">
          <div className="border-b border-border-strong px-2.5 pb-2 pt-1">
            <p className="text-xs text-text-muted">{t(locale, "nav_signed_in_as")}</p>
            <p className="truncate text-sm text-text-primary">{email}</p>
          </div>
          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="text-sm text-text-secondary">DA / EN</span>
            <div className="flex overflow-hidden rounded-md border border-border-strong text-xs">
              {(["DA", "EN"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onLocale(option)}
                  className={`px-2 py-1 ${
                    locale === option ? "bg-hf-green-dark text-hf-white" : "text-text-secondary hover:bg-hf-tan"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-md px-2.5 py-2 text-left text-sm text-text-secondary hover:bg-hf-tan hover:text-text-primary"
          >
            {t(locale, "nav_logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({ locale, pathname }: { locale: Locale; pathname: string }) {
  const crumbs: { label: string; href?: string }[] = [{ label: "Admin", href: "/admin" }];
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
  if (crumbs.length === 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
      {crumbs.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="truncate hover:text-text-primary hover:underline">
              {crumb.label}
            </Link>
          ) : (
            <span className="truncate">{crumb.label}</span>
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
  children,
}: {
  email: string;
  locale: Locale;
  hasOpenUncertainties?: boolean;
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      } else if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
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

  return (
    <div className="min-h-dvh bg-page-bg text-text-primary">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border-strong bg-surface-2 px-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t(currentLocale, "nav_open_menu")}
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-hf-tan lg:hidden"
        >
          <Icon name="menu" />
        </button>
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <Image src="/hello-cal-logo.png" alt="Hello Cal" width={90} height={40} priority />
          <span className="hidden border-l border-border-strong pl-2 text-sm font-semibold text-hf-green-dark sm:inline">
            Admin
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border border-border-strong bg-page-bg px-3 text-sm text-text-muted hover:border-hf-green md:flex"
        >
          <Icon name="search" className="h-4 w-4" />
          <span className="flex-1 text-left">{t(currentLocale, "nav_quick_search")}</span>
          <kbd className="rounded border border-border-strong px-1.5 text-[11px]">Ctrl K</kbd>
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={t(currentLocale, "nav_quick_search")}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-hf-tan md:hidden"
        >
          <Icon name="search" />
        </button>
        <UserMenu email={email} locale={currentLocale} onLocale={changeLocale} onLogout={logout} />
      </header>

      <div className="flex">
        <aside
          className={`sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col border-r border-border-strong bg-surface-2 lg:flex ${
            collapsed ? "w-16" : "w-64"
          }`}
        >
          <nav className="flex-1 overflow-y-auto p-2.5">
            <SidebarNav
              locale={currentLocale}
              pathname={pathname}
              badges={badges}
              collapsed={collapsed}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
            />
          </nav>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={t(currentLocale, collapsed ? "nav_expand" : "nav_collapse")}
            className={`flex items-center gap-3 border-t border-border-strong px-5 py-3 text-sm text-text-secondary hover:bg-hf-tan ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <Icon name="collapse" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && t(currentLocale, "nav_collapse")}
          </button>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Breadcrumbs locale={currentLocale} pathname={pathname} />
            {children}
          </div>
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[85vw] max-w-xs flex-col bg-surface-2 shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border-strong px-3">
              <span className="flex items-center gap-2">
                <Image src="/hello-cal-logo.png" alt="Hello Cal" width={90} height={40} />
                <span className="border-l border-border-strong pl-2 text-sm font-semibold text-hf-green-dark">Admin</span>
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t(currentLocale, "nav_close_menu")}
                className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-hf-tan"
              >
                <Icon name="close" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2.5">
              <SidebarNav
                locale={currentLocale}
                pathname={pathname}
                badges={badges}
                collapsed={false}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
              />
            </nav>
            <p className="truncate border-t border-border-strong px-4 py-3 text-xs text-text-muted">{email}</p>
          </aside>
        </div>
      )}

      {searchOpen && <QuickSearch locale={currentLocale} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

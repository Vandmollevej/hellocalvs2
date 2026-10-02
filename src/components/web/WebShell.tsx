"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { IconChevronLeft, IconSearch } from "@tabler/icons-react";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  WEB_HOME,
  WEB_SETTINGS,
  WEB_SHORTCUTS,
  WEB_TOP_NAV,
  type WebNavItem,
} from "@/lib/web-nav";

// Desktop-version af appen (docs/DECISIONS.md 2026-09-29), bygget på
// admin-skallen (`AdminShell`): sidebjælke i fuld højde med logo og søgefelt,
// genveje øverst og indstillinger nedenunder, hvid topbjælke med appens
// bundmenu (uden kamera og stemme, med chat) og profilindstillinger yderst til
// højre. Ingen telefonramme. Selve siderne er appens egne.
const COLLAPSED_KEY = "hc-web-sidebar-collapsed";

// Sider kan spørge, om de vises i desktop-skallen (ScreenHeader bruger det
// til at udelade tilbagepilen på topniveau-sider).
const WebShellContext = createContext(false);
export function useInWebShell() {
  return useContext(WebShellContext);
}

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

// Kun det længste match er aktivt, så /profile/edit ikke også markerer /profile.
const ALL_HREFS = [...WEB_SHORTCUTS, ...WEB_SETTINGS].map(
  (item) => item.href.split("?")[0],
);
function isBestMatch(pathname: string, href: string) {
  if (!isActive(pathname, href)) return false;
  return !ALL_HREFS.some(
    (other) => other.length > href.length && isActive(pathname, other),
  );
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function SideLink({
  item,
  pathname,
  label,
  collapsed,
}: {
  item: WebNavItem;
  pathname: string;
  label: string;
  collapsed: boolean;
}) {
  const active = isBestMatch(pathname, item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        title={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={`hf-type-body flex w-full items-center gap-3 rounded-md px-2.5 py-2 ${collapsed ? "justify-center" : ""} ${
          active
            ? "hf-type-strong bg-hf-tan text-hf-green-dark"
            : "text-text-secondary hover:bg-hf-tan hover:text-text-primary"
        }`}
      >
        <Icon size={20} stroke={1.75} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

export function WebShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { status } = useFamilyStatus();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // localStorage findes først efter hydrering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  // Forsidens drejehjul og tilføj-cirkel findes ikke på desktop: roden
  // sender videre til kalenderens dagsvisning.
  useEffect(() => {
    if (pathname === "/") router.replace(WEB_HOME);
  }, [pathname, router]);

  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1");
      } catch {
        // Privat vindue o.l. — valget huskes bare ikke.
      }
      return !value;
    });
  }

  const q = query.trim().toLowerCase();
  const match = (item: WebNavItem) =>
    !q || t(item.labelKey).toLowerCase().includes(q);
  const shortcuts = WEB_SHORTCUTS.filter(match);
  const settings = WEB_SETTINGS.filter(match);
  const noResults = shortcuts.length === 0 && settings.length === 0;

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const first = shortcuts[0] ?? settings[0];
    if (first) router.push(first.href);
    setQuery("");
  }

  const profileActive =
    isActive(pathname, "/profile") || isActive(pathname, "/settings");

  return (
    <WebShellContext.Provider value={true}>
      <div className="web-shell flex h-dvh bg-page-bg text-hf-black">
        <aside
          aria-label={t("web.sideNav")}
          className={`relative z-30 flex h-dvh shrink-0 flex-col border-r border-hf-tan-dark bg-hf-white ${collapsed ? "w-16" : "w-64"}`}
        >
          <div
            className={`flex h-20 shrink-0 items-center border-b border-hf-tan-dark ${collapsed ? "justify-center" : "px-4"}`}
          >
            <Link href={WEB_HOME} className="flex items-center">
              <Image
                src="/hello-cal-logo.png"
                alt="Hello Cal"
                width={collapsed ? 48 : 124}
                height={collapsed ? 21 : 55}
                priority
              />
            </Link>
          </div>

          <div className="shrink-0 px-2.5 pt-2.5">
            {collapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                title={t("web.searchPlaceholder")}
                aria-label={t("web.searchPlaceholder")}
                className="flex h-9 w-full items-center justify-center rounded-md text-text-secondary hover:bg-hf-tan"
              >
                <IconSearch size={16} stroke={1.75} />
              </button>
            ) : (
              <form onSubmit={onSearchSubmit} role="search">
                <label className="hf-type-body flex h-9 w-full items-center gap-2 rounded-md border border-hf-tan-dark bg-hf-white px-3 focus-within:border-hf-green">
                  <IconSearch
                    size={16}
                    stroke={1.75}
                    className="shrink-0 text-text-muted"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("web.searchPlaceholder")}
                    aria-label={t("web.searchPlaceholder")}
                    className="min-w-0 flex-1 bg-transparent text-hf-black outline-none placeholder:text-text-muted"
                  />
                </label>
              </form>
            )}
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {shortcuts.length > 0 && (
              <section>
                {!collapsed && (
                  <h2 className="hf-type-small px-2.5 pb-1 pt-1 font-semibold uppercase tracking-wide text-text-muted">
                    {t("web.shortcuts")}
                  </h2>
                )}
                <ul className="flex flex-col gap-0.5">
                  {shortcuts.map((item) => (
                    <SideLink
                      key={item.key}
                      item={item}
                      pathname={pathname}
                      label={t(item.labelKey)}
                      collapsed={collapsed}
                    />
                  ))}
                </ul>
              </section>
            )}
            {settings.length > 0 && (
              <section className="mt-3 border-t border-hf-tan-dark pt-3">
                {!collapsed && (
                  <h2 className="hf-type-small px-2.5 pb-1 font-semibold uppercase tracking-wide text-text-muted">
                    {t("web.settings")}
                  </h2>
                )}
                <ul className="flex flex-col gap-0.5">
                  {settings.map((item) => (
                    <SideLink
                      key={item.key}
                      item={item}
                      pathname={pathname}
                      label={t(item.labelKey)}
                      collapsed={collapsed}
                    />
                  ))}
                </ul>
              </section>
            )}
            {noResults && (
              <p className="hf-type-body px-2.5 py-4 text-text-muted">
                {t("web.noResults")}
              </p>
            )}
          </nav>

          <button
            type="button"
            onClick={toggleCollapsed}
            title={t(collapsed ? "web.expand" : "web.collapse")}
            aria-label={t(collapsed ? "web.expand" : "web.collapse")}
            className="absolute left-full top-1/2 z-30 -translate-y-1/2 flex h-9 w-7 items-center justify-center rounded-r-md border border-l-0 border-hf-tan-dark bg-hf-white text-text-secondary hover:bg-hf-tan"
          >
            <IconChevronLeft
              size={16}
              stroke={1.75}
              className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-end justify-between gap-3 border-b border-hf-tan-dark bg-hf-white px-6 pb-2.5">
            <nav aria-label={t("web.mainNav")}>
              <ul className="flex items-center gap-1">
                {WEB_TOP_NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`hf-type-body flex h-9 items-center gap-2 rounded-md px-3 ${
                          active
                            ? "hf-type-strong bg-hf-tan text-hf-green-dark"
                            : "text-text-secondary hover:bg-hf-tan hover:text-text-primary"
                        }`}
                      >
                        <Icon size={20} stroke={1.75} />
                        {t(item.labelKey)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <Link
              href="/profile"
              aria-label={t("web.profileSettings")}
              className={`hf-type-body flex h-9 items-center gap-2 rounded-md pl-1.5 pr-3 ${
                profileActive
                  ? "hf-type-strong bg-hf-tan text-hf-green-dark"
                  : "text-text-secondary hover:bg-hf-tan hover:text-text-primary"
              }`}
            >
              <ProfileCircle
                name={status?.activeProfile.displayName ?? ""}
                size={32}
                className="hf-avatar--outlined"
              />
              {t("web.profileSettings")}
            </Link>
          </header>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            {/* transform holder appens position: fixed-ark og -menuer inde i indholdsfladen. */}
            <div
              className="web-shell-content mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-hf-cream"
              style={{ transform: "translateZ(0)" }}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </WebShellContext.Provider>
  );
}

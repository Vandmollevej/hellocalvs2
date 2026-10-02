"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { useAddActionsProfile, visibleAddActions } from "@/lib/add-actions";
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
  const [collapsed, setCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const addProfile = useAddActionsProfile();
  // Mikrofonen findes ikke på desktop (chat afløser den).
  const addActions = visibleAddActions(addProfile).filter((a) => a.key !== "microphone");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddOpen(false);
  }, [pathname]);

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

  const shortcuts = WEB_SHORTCUTS;
  const settings = WEB_SETTINGS;

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
          </nav>

          <button
            type="button"
            onClick={toggleCollapsed}
            title={t(collapsed ? "web.expand" : "web.collapse")}
            aria-label={t(collapsed ? "web.expand" : "web.collapse")}
            className="absolute left-full top-1/2 z-30 flex h-[72px] w-7 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-hf-tan-dark bg-hf-white hover:bg-hf-tan"
          >
            {/* Præcis som i admin: samme grå træk-streg som kalenderens og bundarkenes håndtag, blot lodret. */}
            <span className="block h-10 w-1 rounded-full bg-hf-gray" />
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative z-20 flex h-20 shrink-0 items-end justify-between gap-3 border-b border-hf-tan-dark bg-hf-white px-6 pb-2.5">
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
            <div className="flex items-end gap-4">
            {/* Grøn cirkel med hvidt plus; 20 % af den hænger ned over headerens streg. */}
            <button
              type="button"
              onClick={() => setAddOpen((value) => !value)}
              aria-expanded={addOpen}
              aria-label={t("addMenu.title")}
              title={t("addMenu.title")}
              className="-mb-5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-hf-green text-hf-white shadow-md transition hover:bg-hf-green-dark"
            >
              <IconPlus size={28} stroke={2} />
            </button>
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
            </div>
            {addOpen && (
              <div className="absolute left-0 right-0 top-full z-20 border-b border-hf-tan-dark bg-hf-white pt-4 shadow-sm">
                <ul className="flex items-start justify-center gap-2 overflow-x-auto px-6 py-3">
                  {addActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <li key={action.key}>
                        <Link
                          href={action.href}
                          className="hf-type-small flex w-24 flex-col items-center gap-1.5 rounded-md px-2 py-2 text-center text-text-secondary hover:bg-hf-tan hover:text-text-primary"
                        >
                          {Icon && <Icon size={28} stroke={1.75} />}
                          <span>{t(action.labelKey)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
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

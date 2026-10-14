"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  IconChevronDown,
  IconLogout,
  IconPlus,
  IconSettings,
  IconUser,
  IconWorld,
} from "@tabler/icons-react";
import { AddMenuList } from "@/components/add/AddMenuList";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { helpPagePath } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";
import { clearOfflineCache } from "@/lib/offline-cache";
import {
  WEB_HOME,
  WEB_SECTIONS,
  WEB_SUPPORT,
  WEB_TOP_NAV,
  flattenWebNav,
  isWebRootPath,
  type WebNavBadge,
  type WebNavItem,
} from "@/lib/web-nav";
import { WEB_COLLAPSED_KEY, clearSidebarState, readSidebarState, writeSidebarState } from "@/lib/sidebar-state";

// Desktop-version af appen (docs/DECISIONS.md 2026-09-29), bygget på
// admin-skallen (`AdminShell`): sidebjælke i fuld højde med logo og søgefelt,
// genveje øverst og indstillinger nedenunder, hvid topbjælke med appens
// bundmenu (uden kamera og stemme, med chat) og profilindstillinger yderst til
// højre. Ingen telefonramme. Selve siderne er appens egne.
const COLLAPSED_KEY = WEB_COLLAPSED_KEY;

// Profil-dropdown yderst til højre i topbjælken.
const PROFILE_MENU = [
  { href: "/profile", labelKey: "nav.profile", icon: IconUser },
  { href: "/profile/settings/language-region", labelKey: "settings.languageAndRegion", icon: IconWorld },
  { href: "/settings", labelKey: "web.allSettings", icon: IconSettings },
];

// Sider kan spørge, om de vises i desktop-skallen (ScreenHeader bruger det
// til at udelade tilbagepilen på topniveau-sider).
const WebShellContext = createContext(false);
export function useInWebShell() {
  return useContext(WebShellContext);
}

// Hvilke betingede punkter og tal sidebjælken viser for den indloggede profil.
type NavState = {
  isFemale: boolean;
  // Kvindelig eller ukendt profil (Graviditet og amning).
  maybeFemale: boolean;
  showFamily: boolean;
  controlsOthers: boolean;
  controlled: boolean;
  badges: Record<WebNavBadge, number>;
};
const NavStateContext = createContext<NavState>({
  isFemale: false,
  maybeFemale: true,
  showFamily: false,
  controlsOthers: false,
  controlled: false,
  badges: { messages: 0, controlLog: 0 },
});

function isVisible(item: WebNavItem, state: NavState) {
  switch (item.requires) {
    case "female":
      return state.isFemale;
    case "notMale":
      return state.maybeFemale;
    case "family":
      return state.showFamily;
    case "controlsOthers":
      return state.controlsOthers;
    case "controlled":
      return state.controlled;
    default:
      return true;
  }
}

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

// Kun det længste match er aktivt, så /profile/edit ikke også markerer /profile.
// Handlingspunkter (fx "Kontoopsætning" → /settings?guide=1) deltager ikke.
const ALL_ITEMS: WebNavItem[] = [
  ...WEB_SECTIONS.flatMap((section) => flattenWebNav(section.items)),
  WEB_SUPPORT,
];
const ALL_HREFS = ALL_ITEMS.filter((item) => !item.action).map((item) => item.href.split("?")[0]);
function isBestMatch(pathname: string, item: WebNavItem) {
  if (item.action) return false;
  const href = item.href.split("?")[0];
  if (!isActive(pathname, href)) return false;
  return !ALL_HREFS.some(
    (other) => other.length > href.length && isActive(pathname, other),
  );
}

// Kun så længe fanen er åben (sessionStorage): et nyt besøg starter altid med
// udvidet sidebjælke og alle grupper foldet ud (src/lib/sidebar-state.ts).
function readCollapsed() {
  return readSidebarState(COLLAPSED_KEY) === "1";
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
  const { locale } = useTranslation();
  const { badges } = useContext(NavStateContext);
  const active = isBestMatch(pathname, item);
  const Icon = item.icon;
  const count = item.badge ? badges[item.badge] : 0;
  const className = `hf-navrow ${collapsed ? "hf-navrow--rail" : ""}`;
  const content = (
    <>
      <Icon size={20} stroke={1.75} />
      {!collapsed && <span className="hf-navrow__label">{label}</span>}
      {count > 0 &&
        (collapsed ? (
          <span className="hf-navrow__dot" aria-hidden="true" />
        ) : (
          <span
            className="hf-type-caption flex h-5 min-w-5 items-center justify-center rounded-full bg-hf-brand px-1 text-hf-white"
            aria-label={`${count}`}
          >
            {count > 99 ? "99+" : count}
          </span>
        ))}
    </>
  );
  return (
    <li>
      {item.external === "help" ? (
        // Hjælpecentret er en statisk side i public/ — fuld sideindlæsning.
        <a href={helpPagePath(locale)} title={collapsed ? label : undefined} className={className}>
          {content}
        </a>
      ) : (
        <Link
          href={item.href}
          title={collapsed ? label : undefined}
          aria-current={active ? "page" : undefined}
          className={className}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

// Punkt med undermenu (Visning): foldet ud som standard, hver gang siden åbnes
// på ny; trykkes der på punktet, foldes det sammen/ud. Foldet sammen
// sidebjælke linker direkte videre.
function SideGroup({
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
  const { t } = useTranslation();
  const state = useContext(NavStateContext);
  const children = (item.children ?? []).filter((child) => isVisible(child, state));
  const inside = children.some((child) => isBestMatch(pathname, child));
  const [open, setOpen] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (inside) setOpen(true);
  }, [inside]);
  const Icon = item.icon;
  if (collapsed) return <SideLink item={item} pathname={pathname} label={label} collapsed />;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`hf-navrow ${inside ? "is-inside" : ""}`}
      >
        <Icon size={20} stroke={1.75} />
        <span className="hf-navrow__label">{label}</span>
        <IconChevronDown size={16} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <ul className="hf-shell__list hf-shell__list--sub pl-4">
          {children.map((child) => (
            <SideLink key={child.key} item={child} pathname={pathname} label={t(child.labelKey)} collapsed={false} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Brødkrummer øverst i indholdsfladen (som i admin) på sider under topniveau.
const CRUMB_LABELS: Record<string, string> = {
  betingelser: "Betingelser",
  privatlivspolitik: "Privatlivspolitik",
  login: "Log ind",
  signup: "Opret konto",
  "forgot-password": "Glemt adgangskode",
  "reset-password": "Nulstil adgangskode",
  "verify-email": "Bekræft e-mail",
  forward: "Videresend",
  "family-code": "Familiekode",
  scan: "Scan",
  welcome: "Velkommen",
};

function Crumbs({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const all = ALL_ITEMS;
  const segs = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: "Hello Cal", href: WEB_HOME }];
  let acc = "";
  segs.forEach((seg, i) => {
    acc += `/${seg}`;
    const item = all.find((n) => n.href.split("?")[0] === acc);
    const last = i === segs.length - 1;
    const label = item ? t(item.labelKey) : last ? CRUMB_LABELS[seg] : undefined;
    if (label) crumbs.push({ label, href: last ? undefined : acc });
  });
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className="hf-crumbs hf-crumbs--bar">
      {crumbs.map((c, i) => (
        <span key={`${c.label}-${i}`} className="hf-crumbs__item">
          {i > 0 && <span aria-hidden="true">/</span>}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="hf-crumbs__current">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// `overlays` vises inde i indholdsfladen (bundark er position: fixed inde i
// transform-holderen) — se WebStartPrompts.
export function WebShell({ children, overlays }: { children: React.ReactNode; overlays?: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { status } = useFamilyStatus();
  const [collapsed, setCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);

  // Luk den grønne tilføj-dropdown ved klik udenfor.
  useEffect(() => {
    if (!addOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (addButtonRef.current?.contains(target) || addPanelRef.current?.contains(target)) return;
      setAddOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [addOpen]);

  // Luk profil-dropdown ved klik udenfor og ved sideskift.
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!profileMenuRef.current?.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileOpen(false);
  }, [pathname]);
  const [isFemale, setIsFemale] = useState(false);
  const [maybeFemale, setMaybeFemale] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => (response.ok ? ((await response.json()) as { user: { sex: "FEMALE" | "MALE" | null } }) : null))
      .then((data) => {
        if (cancelled || !data) return;
        setIsFemale(data.user.sex === "FEMALE");
        setMaybeFemale(data.user.sex !== "MALE");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Ulæste beskeder (grønt tal ved Beskeder i sidebjælken, som på Profil-siden).
  // Hentes igen ved sideskift, så tallet falder, når beskeder er læst. Kun for
  // indloggede (status findes ikke på offentlige sider).
  const loggedIn = Boolean(status);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetch("/api/messages")
      .then(async (response) => (response.ok ? ((await response.json()) as { unreadCount?: number }) : null))
      .then((data) => {
        if (!cancelled && data) setUnreadMessages(data.unreadCount ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loggedIn, pathname]);

  // Samme betingelser som appens Indstillinger (src/app/settings/page.tsx).
  const navState: NavState = {
    isFemale,
    maybeFemale,
    showFamily: Boolean(status?.hasFamilyPlan || status?.family),
    controlsOthers: Boolean(
      status?.family?.members.some(
        (member) => member.controllerId === status.me.id && member.userId !== status.me.id,
      ),
    ),
    controlled: Boolean(status?.family && !status.family.isOwner),
    badges: { messages: unreadMessages, controlLog: status?.unseenCount ?? 0 },
  };

  function logOut() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      clearOfflineCache();
      clearSidebarState();
      router.push("/login");
      router.refresh();
    });
  }

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
      writeSidebarState(COLLAPSED_KEY, value ? "0" : "1");
      return !value;
    });
  }

  const profileActive =
    isActive(pathname, "/profile") || isActive(pathname, "/settings");

  return (
    <WebShellContext.Provider value={true}>
     <NavStateContext.Provider value={navState}>
      {/* Fælles skal-klasser med admin (globals.css, design.md §6.17). */}
      <div className="web-shell hf-shell hf-shell--tall hf-shell--fixed">
        <aside aria-label={t("web.sideNav")} className={`hf-shell__sidebar ${collapsed ? "is-collapsed" : ""}`}>
          <div className="hf-shell__brand">
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

          <nav className="hf-shell__nav">
            {WEB_SECTIONS.map((section) => {
              const items = section.items.filter((item) => isVisible(item, navState));
              if (items.length === 0) return null;
              return (
                <section key={section.key} className="hf-shell__section">
                  {!collapsed && <h2 className="hf-shell__section-title">{t(section.titleKey)}</h2>}
                  <ul className="hf-shell__list">
                    {items.map((item) =>
                      item.children ? (
                        <SideGroup
                          key={item.key}
                          item={item}
                          pathname={pathname}
                          label={t(item.labelKey)}
                          collapsed={collapsed}
                        />
                      ) : (
                        <SideLink
                          key={item.key}
                          item={item}
                          pathname={pathname}
                          label={t(item.labelKey)}
                          collapsed={collapsed}
                        />
                      ),
                    )}
                  </ul>
                </section>
              );
            })}
          </nav>

          {/* Support: egen boks nederst til venstre under en skillelinje. */}
          <div className="hf-shell__footer">
            <ul className="hf-shell__list">
              <SideLink
                item={WEB_SUPPORT}
                pathname={pathname}
                label={t(WEB_SUPPORT.labelKey)}
                collapsed={collapsed}
              />
            </ul>
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            title={t(collapsed ? "web.expand" : "web.collapse")}
            aria-label={t(collapsed ? "web.expand" : "web.collapse")}
            className="hf-shell__handle"
          />
        </aside>

        <div className="hf-shell__body">
          <header className="hf-shell__topbar hf-shell__topbar--bottom">
            <nav aria-label={t("web.mainNav")}>
              <ul className="hf-shell__topnav">
                {WEB_TOP_NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        title={t(item.labelKey)}
                        className="hf-navrow"
                      >
                        <Icon size={20} stroke={1.75} />
                        <span className="hf-shell__toplabel">{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="flex items-end gap-4">
            {/* Grøn cirkel med hvidt plus; 20 % af den hænger ned over headerens streg. */}
            <button
              ref={addButtonRef}
              type="button"
              onClick={() => setAddOpen((value) => !value)}
              aria-expanded={addOpen}
              aria-label={t("addMenu.title")}
              title={t("addMenu.title")}
              className="hf-shell__add"
            >
              <IconPlus size={28} stroke={2} />
            </button>
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                aria-label={t("web.profileSettings")}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((open) => !open)}
                title={t("web.profileSettings")}
                className={`hf-navrow hf-navrow--inline hf-navrow--profile ${profileActive || profileOpen ? "is-active" : ""}`}
              >
                {/* Kun cirklen (ingen tekst ved siden af), 44 px i den høje topbjælke. */}
                <ProfileCircle
                  name={status?.activeProfile.displayName ?? ""}
                  size={44}
                  className="hf-avatar--outlined"
                />
                <IconChevronDown size={16} stroke={1.75} />
              </button>
              {profileOpen && (
                <ul role="menu" className="hf-menu absolute right-0 top-full mt-1 w-60">
                  {PROFILE_MENU.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href} role="none">
                        <Link href={item.href} role="menuitem" className="hf-navrow">
                          <Icon size={18} stroke={1.75} />
                          {t(item.labelKey)}
                        </Link>
                      </li>
                    );
                  })}
                  <li role="none">
                    <button type="button" role="menuitem" onClick={logOut} className="hf-navrow">
                      <IconLogout size={18} stroke={1.75} />
                      {t("settings.logOut")}
                    </button>
                  </li>
                </ul>
              )}
            </div>
            </div>
            {addOpen && (
              // Samme ikon-firkanter som mobilens tilføj-vindue (AddMenuList).
              // Optag udelades, fordi chat afløser mikrofonen på desktop, og
              // Scan og Tallerkenbillede, fordi kameraet ikke kan bruges på en
              // computer (bruger 2026-10-11).
              <div
                ref={addPanelRef}
                className="absolute left-0 right-0 top-full z-20 max-h-[calc(100dvh-var(--hf-shell-bar))] overflow-y-auto border-b border-hf-tan-dark bg-hf-white shadow-sm"
              >
                <div className="mx-auto max-w-4xl">
                  <AddMenuList editable={false} excludeKeys={["voice", "scan", "platePhoto"]} />
                </div>
              </div>
            )}
          </header>

          <main className="hf-shell__main min-h-0 overflow-y-auto">
            {/* transform holder appens position: fixed-ark og -menuer inde i indholdsfladen. */}
            <div
              className="web-shell-content mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-hf-cream transform-gpu"
            >
              {!isWebRootPath(pathname) && <Crumbs pathname={pathname} />}
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
              {overlays}
            </div>
          </main>
        </div>
      </div>
     </NavStateContext.Provider>
    </WebShellContext.Provider>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { IconSearch, IconUser } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { WEB_SETTINGS, WEB_SHORTCUTS, WEB_TOP_NAV, type WebNavItem } from "@/lib/web-nav";

// Desktop-version af appen (docs/DECISIONS.md 2026-09-29). Rammen følger
// admin-skallen: sidebjælke til venstre med logo og søgefelt, genveje øverst og
// indstillinger nedenunder; appens bundmenu ligger som topbjælke, og
// profilindstillinger sidder i samme bjælke. Selve siderne er appens egne.
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideLink({ item, pathname, label }: { item: WebNavItem; pathname: string; label: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition ${
          active ? "bg-hf-tan font-semibold text-hf-black" : "text-[var(--hf-color-text-secondary)] hover:bg-hf-tan/60"
        }`}
      >
        <Icon size={20} stroke={1.6} />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}

export function WebShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const match = (item: WebNavItem) => !q || t(item.labelKey).toLowerCase().includes(q);
  const shortcuts = WEB_SHORTCUTS.filter(match);
  const settings = WEB_SETTINGS.filter(match);
  const noResults = shortcuts.length === 0 && settings.length === 0;

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const first = shortcuts[0] ?? settings[0];
    if (first) router.push(first.href);
    setQuery("");
  }

  return (
    <div className="web-shell flex h-dvh bg-hf-cream text-hf-black">
      <aside
        aria-label={t("web.sideNav")}
        className="flex w-64 shrink-0 flex-col border-r border-hf-tan-dark bg-white"
      >
        <Link href="/" className="flex h-16 shrink-0 items-center px-5">
          <Image src="/hello-cal-logo.png" alt="Hello Cal" width={240} height={80} className="h-auto w-28" priority />
        </Link>

        <form onSubmit={onSearchSubmit} className="px-4 pb-3" role="search">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--hf-color-field-border)] px-3 focus-within:border-hf-black">
            <IconSearch size={18} stroke={1.6} className="shrink-0 text-[var(--hf-color-text-secondary)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("web.searchPlaceholder")}
              aria-label={t("web.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--hf-color-text-secondary)]"
            />
          </label>
        </form>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {shortcuts.length > 0 && (
            <section>
              <h2 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--hf-color-text-secondary)]">
                {t("web.shortcuts")}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {shortcuts.map((item) => (
                  <SideLink key={item.key} item={item} pathname={pathname} label={t(item.labelKey)} />
                ))}
              </ul>
            </section>
          )}
          {settings.length > 0 && (
            <section className="mt-4 border-t border-hf-tan-dark pt-2">
              <h2 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--hf-color-text-secondary)]">
                {t("web.settings")}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {settings.map((item) => (
                  <SideLink key={item.key} item={item} pathname={pathname} label={t(item.labelKey)} />
                ))}
              </ul>
            </section>
          )}
          {noResults && <p className="px-3 py-4 text-sm text-[var(--hf-color-text-secondary)]">{t("web.noResults")}</p>}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-hf-tan-dark bg-hf-tan-dark/60 px-6">
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
                      className={`flex h-10 items-center gap-2 rounded-lg px-4 text-[15px] transition ${
                        active ? "bg-white font-semibold text-hf-black shadow-sm" : "text-[var(--hf-color-text-secondary)] hover:bg-white/60"
                      }`}
                    >
                      <Icon size={20} stroke={1.6} />
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
            className={`flex h-11 items-center gap-2 rounded-lg px-4 text-[15px] transition ${
              isActive(pathname, "/profile") || isActive(pathname, "/settings")
                ? "bg-white font-semibold shadow-sm"
                : "text-[var(--hf-color-text-secondary)] hover:bg-white/60"
            }`}
          >
            <IconUser size={20} stroke={1.6} />
            {t("web.profileSettings")}
          </Link>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-hf-cream">
          {/* transform gør, at appens position: fixed-ark og -menuer holdes inde i indholdsfladen. */}
          <div
            className="web-shell-content mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden border-x border-hf-tan-dark bg-hf-cream"
            style={{ transform: "translateZ(0)" }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@prisma/client";
import { t, type AdminI18nKey } from "@/lib/admin-i18n";

const LINK_DEFS: { href: string; key: AdminI18nKey }[] = [
  { href: "/admin", key: "nav_overview" },
  { href: "/admin/products", key: "nav_products" },
  { href: "/admin/users", key: "nav_users" },
  { href: "/admin/bug-reports", key: "nav_bug_reports" },
  { href: "/admin/messaging", key: "nav_messaging" },
  { href: "/admin/images", key: "nav_images" },
  { href: "/admin/warnings", key: "nav_warnings" },
  { href: "/admin/search", key: "nav_search" },
  { href: "/admin/passkeys", key: "nav_passkeys" },
];

export function AdminNav({ email, locale }: { email: string; locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState(locale);

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

  return (
    <header className="border-b border-border-strong bg-surface-2">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2">
          <Image src="/hello-cal-logo.png" alt="Hello Cal" width={110} height={49} priority />
          <span className="text-sm font-semibold text-hf-green-dark">Admin</span>
        </span>
        <nav className="flex flex-1 flex-wrap gap-4 text-sm">
          {LINK_DEFS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-medium text-hf-green-dark"
                  : "text-text-secondary hover:text-text-primary"
              }
            >
              {t(currentLocale, link.key)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <div className="flex overflow-hidden rounded-md border border-border-strong">
            {(["DA", "EN"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => changeLocale(option)}
                className={`px-2 py-1 ${
                  currentLocale === option ? "bg-hf-green-dark text-hf-white" : "text-text-secondary hover:bg-hf-tan"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <span className="hidden sm:inline">{email}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-border-strong px-2.5 py-1 text-text-secondary hover:bg-hf-tan"
          >
            {t(currentLocale, "nav_logout")}
          </button>
        </div>
      </div>
    </header>
  );
}

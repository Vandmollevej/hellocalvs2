"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Oversigt" },
  { href: "/admin/produkter", label: "Nye produkter" },
  { href: "/admin/billeder", label: "Billedforslag" },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border-strong bg-surface-2">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <span className="text-sm font-semibold text-hf-green-dark">HELLO CAL — Admin</span>
        <nav className="flex flex-1 flex-wrap gap-4 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-medium text-hf-green-dark"
                  : "text-text-secondary hover:text-text-primary"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="hidden sm:inline">{email}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-border-strong px-2.5 py-1 text-text-secondary hover:bg-hf-tan"
          >
            Log ud
          </button>
        </div>
      </div>
    </header>
  );
}

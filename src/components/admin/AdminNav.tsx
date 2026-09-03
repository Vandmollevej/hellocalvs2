"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Oversigt" },
  { href: "/admin/products", label: "Nye produkter" },
  { href: "/admin/users", label: "Brugere" },
  { href: "/admin/bug-reports", label: "Fejlrapporter" },
  { href: "/admin/messaging", label: "Besked automatisering" },
  { href: "/admin/images", label: "Billedforslag" },
  { href: "/admin/warnings", label: "Advarsler" },
  { href: "/admin/search", label: "Søg" },
  { href: "/admin/passkeys", label: "Passkeys" },
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
        <span className="flex items-center gap-2">
          <Image src="/hello-cal-logo.png" alt="Hello Cal" width={110} height={49} priority />
          <span className="text-sm font-semibold text-hf-green-dark">Admin</span>
        </span>
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

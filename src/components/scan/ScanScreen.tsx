"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconBarcode, IconLayoutGrid, IconUser } from "@tabler/icons-react";
import { HfChevron } from "@/components/hf/HfChevron";
import { ScanLocationGate } from "@/components/scan/ScanLocation";

// Skal for Oprettelses-appen: samme appbar og bundnavigation som Hello Cal
// (design.md §6.1/§6.10), men bundmenuen har kun to knapper, og brugerikonet
// øverst til højre åbner medarbejdermenuen.

const NAV_ITEMS = [
  { href: "/scan", label: "Billede af hylde", Icon: IconLayoutGrid },
  { href: "/scan/opret", label: "Opret vare", Icon: IconBarcode },
];

export function ScanScreen({
  title,
  children,
  showBack = false,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-hf-cream">
      <div className="hf-appbar hf-appbar--brand">
        <div className="hf-appbar__slot">
          {showBack && (
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? router.back() : router.replace("/scan"))}
              aria-label="Tilbage"
              className="flex h-full w-full items-center justify-center text-hf-white"
            >
              <HfChevron direction="left" />
            </button>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-center">
          <h1 className="hf-type-nav-title hf-appbar__title">{title}</h1>
        </div>
        <div className="hf-appbar__slot">
          <Link href="/scan/menu" aria-label="Åbn menu">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-tan text-hf-black">
              <IconUser size={18} stroke={2} />
            </span>
          </Link>
        </div>
      </div>
      <ScanLocationGate>
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="flex-shrink-0 bg-hf-cream p-4">{footer}</div>}
      </ScanLocationGate>
      <nav className="border-t border-hf-gray-border bg-hf-tan-dark pb-[env(safe-area-inset-bottom,0px)] pt-2" aria-label="Hovedmenu">
        <div className="grid grid-cols-2 justify-items-center pt-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            const color = active ? "#232323" : "#656565";
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex h-14 flex-col items-center justify-center gap-2 px-4"
              >
                <Icon size={24} stroke={1.6} color={color} />
                <span className="hf-type-tab" style={{ color }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

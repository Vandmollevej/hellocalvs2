"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconPlus, IconApple, IconCalendar } from "@tabler/icons-react";

function TrendIcon({ active }: { active: boolean }) {
  const color = active ? "var(--hf-black)" : "var(--hf-gray)";
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline
        points="2,19 9,12 14,15 22,3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="19" r="1.6" fill={color} />
      <circle cx="14" cy="15" r="1.6" fill={color} />
      <circle cx="22" cy="3" r="1.6" fill={color} />
    </svg>
  );
}

const items = [
  { key: "tilfoej", href: "/", label: "Tilføj", Icon: IconPlus },
  { key: "madvarer", href: "/madvarer", label: "Madvarer", Icon: IconApple },
  { key: "kalender", href: "/kalender", label: "Kalender", Icon: IconCalendar },
  { key: "statistik", href: "/statistik", label: "Statistik", Icon: null },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-start border-t border-hf-tan-dark bg-hf-tan pb-6 pt-2.5"
      aria-label="Hovednavigation"
    >
      {items.map((item, i) => {
        const active = pathname === item.href;
        const color = active ? "var(--hf-black)" : "var(--hf-gray)";
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 ${
              i < items.length - 1 ? "border-r border-hf-tan-dark" : ""
            }`}
          >
            {item.Icon ? (
              <item.Icon size={24} stroke={1.5} color={color} />
            ) : (
              <TrendIcon active={active} />
            )}
            <span
              className="text-[11px]"
              style={{ color, fontFamily: "var(--font-hf-body)" }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

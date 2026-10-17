import Link from "next/link";
import { IconClipboardHeart, IconMoon } from "@tabler/icons-react";
import { FoodRow } from "@/components/FoodRow";
import { HfChevron } from "@/components/hf/HfChevron";

// En række på Screeninger er bygget som madvarelistens rækker (bruger
// 2026-10-17): px-4-ramme med streg, den globale FoodRow (44 px felt, titel,
// caption) og pilen yderst til højre. Status står som caption under navnet.
export function ScreeningRow({
  href,
  label,
  active,
  statusText,
  sleep = false,
  divider,
}: {
  href: string;
  label: string;
  active: boolean;
  statusText: string;
  sleep?: boolean;
  divider: boolean;
}) {
  const Icon = sleep ? IconMoon : IconClipboardHeart;
  return (
    <div className={`bg-hf-tan px-4 ${divider ? "border-b border-hf-tan-dark" : ""}`}>
      <Link href={href} className="block">
        <FoodRow
          thumbnail={<Icon size={24} stroke={1.6} className="text-hf-black" aria-hidden="true" />}
          title={label}
          subtitle={
            <p className={`hf-type-caption flex items-center gap-1.5 ${active ? "text-hf-green-dark" : "text-text-secondary"}`}>
              <span className={`hf-status-dot${active ? " is-active" : ""}`} aria-hidden="true" />
              {statusText}
            </p>
          }
          right={<HfChevron className="text-hf-black" />}
        />
      </Link>
    </div>
  );
}

import Image from "next/image";
import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Konfettikanon — the "Målsætning" (goals) icon, also the calendar's marker
 * for a målsætning's target date. This is the user's own artwork
 * (public/icons/party-popper.png: black silhouette on transparent). Rendered
 * as a CSS mask so it takes `color` / `currentColor` like the tabler icons it
 * sits beside. The PNG is used as-is; do not redraw it as SVG (see
 * docs/DECISIONS.md 2026-09-27). `stroke` is accepted for API compatibility
 * and ignored. The coloured version (PartyPopperImage) is reserved for the
 * target-date circle in the calendar.
 */
export function IconPartyPopper({
  size = 24,
  color = "currentColor",
  className,
  style,
}: ComponentProps<Icon>) {
  const mask = "url(/icons/party-popper.png) center / contain no-repeat";
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: color,
        mask,
        WebkitMask: mask,
        ...style,
      }}
    />
  );
}

/** Coloured 3D konfettikanon — only for the calendar's target-date circle. */
export function PartyPopperImage({ size, className }: { size: number; className?: string }) {
  return (
    <Image
      src="/icons/party-popper-color.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    />
  );
}

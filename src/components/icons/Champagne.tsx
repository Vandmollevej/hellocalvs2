import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Champagne bottle popping its cork — the "Målsætning" (goals) icon. This is
 * the user's own artwork (public/icons/champagne.png, a 256 px copy of the
 * uploaded Målsætning.png cropped to the drawing: black silhouette on
 * transparent). Rendered as a CSS mask so it takes `color` / `currentColor`
 * like the tabler icons it sits beside. The PNG is used as-is; do not redraw
 * it as SVG (see docs/DECISIONS.md 2026-09-27). `stroke` is accepted for API
 * compatibility and ignored.
 */
export function IconChampagne({
  size = 24,
  color = "currentColor",
  className,
  style,
}: ComponentProps<Icon>) {
  const mask = "url(/icons/champagne.png) center / contain no-repeat";
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

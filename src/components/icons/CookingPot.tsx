import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Cooking pot with lid and steam — the "Retter" (own dishes) icon. This is
 * the user's own artwork (public/icons/gryde.png, a 256 px copy of the
 * uploaded gryde.png: black lines on transparent). Rendered as a CSS mask so
 * it takes `color` / `currentColor` like the tabler icons it sits beside.
 * The PNG is used as-is; do not redraw it as SVG (see docs/DECISIONS.md
 * 2026-09-27). `stroke` is accepted for API compatibility and ignored.
 */
export function IconCookingPot({
  size = 24,
  color = "currentColor",
  className,
  style,
}: ComponentProps<Icon>) {
  const mask = "url(/icons/gryde.png) center / contain no-repeat";
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

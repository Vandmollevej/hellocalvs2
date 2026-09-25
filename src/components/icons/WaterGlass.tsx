import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Water glass, drawn from the user's approved artwork
 * (public/icons/water-glass.png — black lines on transparent). Rendered as
 * a CSS mask so it takes `color` / `currentColor` like the tabler icons it
 * sits beside. `stroke` is accepted for API compatibility and ignored.
 */
export function IconWaterGlass({
  size = 24,
  color = "currentColor",
  className,
  style,
}: ComponentProps<Icon>) {
  const mask = "url(/icons/water-glass.png) center / contain no-repeat";
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

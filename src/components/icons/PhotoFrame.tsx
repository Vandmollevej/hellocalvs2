import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Picture frame (outer frame, inner opening and a small landscape), hand-authored
 * to match the tabler outline style (24x24 viewBox, round line caps/joins,
 * `currentColor` stroke) since tabler's icon set has no picture-frame glyph.
 */
export function IconPhotoFrame({
  size = 24,
  color = "currentColor",
  stroke = 2,
  ...rest
}: ComponentProps<Icon>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="0.5" />
      <circle cx="14.6" cy="9.8" r="1" />
      <path d="M6.5 15.5l3.2-3.2 2.6 2.6 1.6-1.6 3.6 3.6" />
    </svg>
  );
}

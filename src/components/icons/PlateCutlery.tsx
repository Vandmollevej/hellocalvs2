import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Plate with a fork on the left and a knife on the right, hand-authored to
 * match the tabler outline style (24x24 viewBox, round line caps/joins,
 * `currentColor` stroke) since tabler's icon set has no plate glyph.
 */
export function IconPlateCutlery({
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
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="3" />
      <line x1="1.6" y1="2.5" x2="1.6" y2="8" />
      <line x1="3" y1="2.5" x2="3" y2="8" />
      <line x1="4.4" y1="2.5" x2="4.4" y2="8" />
      <line x1="3" y1="8" x2="3" y2="21.5" />
      <path d="M20.4 2.5c2 2 2 6.5 0 9" />
      <line x1="19.2" y1="2.5" x2="19.2" y2="11.5" />
      <line x1="20" y1="11.5" x2="20" y2="21.5" />
    </svg>
  );
}

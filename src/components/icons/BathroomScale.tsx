import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Bathroom scale, hand-authored to match the tabler outline style (24x24
 * viewBox, round line caps/joins, `currentColor` stroke) since tabler's icon
 * set has no bathroom-scale glyph — only a gym-weight/kettlebell one
 * (`IconWeight`) and a balance-scale one (`IconScale`), neither of which
 * reads as "step on this and see your weight".
 */
export function IconBathroomScale({
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
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
      <rect x="8.5" y="7.5" width="7" height="4" rx="1" />
      <path d="M10 9.5h3" />
      <path d="M6 16.5h2" />
      <path d="M16 16.5h2" />
    </svg>
  );
}

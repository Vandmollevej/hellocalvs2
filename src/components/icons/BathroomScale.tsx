import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Bathroom scale, hand-authored to match the tabler outline style (24x24
 * viewBox, round line caps/joins, `currentColor` stroke) since tabler's icon
 * set has no bathroom-scale glyph — only a gym-weight/kettlebell one
 * (`IconWeight`) and a balance-scale one (`IconScale`), neither of which
 * reads as "step on this and see your weight". Depicts a dial gauge with
 * two footprints, matching the approved reference artwork.
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
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
      <path d="M9 5.5l7.6 0c.9 0 1.4 .9 1 1.7l-1.1 2.3a1 1 0 0 1 -.9 .5h-5.2a1 1 0 0 1 -.9 -.5l-1.1 -2.3c-.4 -.8 .1 -1.7 1 -1.7z" />
      <path d="M12 6.2v1.3" />
      <path d="M9.7 6.6l.6 1.1" />
      <path d="M14.3 6.6l-.6 1.1" />
      <circle cx="12" cy="8" r=".3" fill={color} />
      <path d="M8.7 12c1.3 0 1.9 1.1 1.7 2.4l-.3 2.2c-.2 1.3 -.7 2.4 -1.9 2.4c-1.2 0 -2 -1.2 -1.9 -2.6l.2 -1.8c.1 -1.4 .8 -2.6 2.2 -2.6z" />
      <path d="M15.3 12c1.3 0 2.1 1.2 2.2 2.6l.2 1.8c.1 1.4 -.7 2.6 -1.9 2.6c-1.2 0 -1.7 -1.1 -1.9 -2.4l-.3 -2.2c-.2 -1.3 .4 -2.4 1.7 -2.4z" />
    </svg>
  );
}

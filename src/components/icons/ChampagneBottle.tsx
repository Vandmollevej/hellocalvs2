import type { SVGProps } from "react";

/**
 * Champagne bottle — the calendar's marker for a målsætning's target date.
 * Drawn in the tabler outline style (24px grid, round caps, currentColor) so
 * it sits naturally beside the tabler icons used elsewhere in the calendar.
 */
export function IconChampagneBottle({
  size = 24,
  stroke = 2,
  ...props
}: Omit<SVGProps<SVGSVGElement>, "stroke"> & { size?: number; stroke?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 2h4v3h-4z" />
      <path d="M10.5 5v3c0 1.5 -2.5 2.5 -2.5 5v7.5a1.5 1.5 0 0 0 1.5 1.5h5a1.5 1.5 0 0 0 1.5 -1.5v-7.5c0 -2.5 -2.5 -3.5 -2.5 -5v-3" />
      <path d="M8 14h8" />
      <path d="M8 18h8" />
    </svg>
  );
}

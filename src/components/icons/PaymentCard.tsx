import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Payment card — the "Betalingsmetoder" (payment methods) icon.
 * Per the owner's rule (2026-10-02): a card outline with one solid black
 * magnetic stripe placed at the bottom, and nothing else (no chip, no
 * signature line, no numbers). Same props as a tabler icon so it can sit
 * next to them in ChevronRow; `stroke` matches tabler's default of 2.
 */
export function IconPaymentCard({
  size = 24,
  color = "currentColor",
  stroke = 2,
  className,
  style,
  ...rest
}: ComponentProps<Icon>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      style={style}
      {...rest}
    >
      {/* Card outline */}
      <rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="2.5"
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      {/* Solid stripe, bottom of the card */}
      <rect x="3" y="13" width="18" height="3.5" fill={color} />
    </svg>
  );
}

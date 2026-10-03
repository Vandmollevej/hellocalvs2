import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Skift profil — two curved arrows, up on the left and down on the right
 * (the owner's wish 2026-10-03: "frem og tilbagepil, buet pil op/ned").
 * Same props as a tabler icon so it can sit in ChevronRow-style rows;
 * `stroke` matches tabler's default of 2.
 */
export function IconSwitchProfile({
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
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
      {...rest}
    >
      <path d="M8 20Q3 12 8 4" />
      <path d="M3.72 5.39L8 4l.63 4.46" />
      <path d="M16 4q5 8 0 16" />
      <path d="M20.28 18.61L16 20l-.63-4.46" />
    </svg>
  );
}

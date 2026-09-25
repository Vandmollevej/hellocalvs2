import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Cooking pot with lid and two steam wisps, a vector trace of the user's
 * approved artwork (public/icons/gryde.png — single even-weight strokes,
 * which the earlier double-outlined steam lacked). Drawn as a tabler-style
 * stroke icon (content fills the 24-unit box edge to edge, `currentColor`)
 * so it stays crisp at the 20–28px sizes the add menu and the front-page +
 * wheel use, and recolours like every other icon instead of needing a CSS
 * filter. Default stroke is 1.5 rather than tabler's 2: at 2 the handle
 * loops and lid knob close up at 24px.
 */
export function IconCookingPot({
  size = 24,
  color = "currentColor",
  stroke = 1.5,
  className,
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
      {...rest}
    >
      <path d="M10.2 1.2c1.2 .9 1.3 2.2 .4 3.2c-.9 1 -.8 1.9 .3 2.6" />
      <path d="M13.8 1.9c1.2 .9 1.3 2.2 .4 3.2c-.9 1 -.8 1.9 .3 2.6" />
      <path d="M9.7 11.9v-1.8a.6 .6 0 0 1 .6 -.6h3.4a.6 .6 0 0 1 .6 .6v1.8" />
      <path d="M4.6 14.3c1.4 -1.75 4 -2.4 7.4 -2.4s6 .65 7.4 2.4" />
      <path d="M3.7 14.3h16.6" />
      <path d="M4.3 14.3v5.6a2.6 2.6 0 0 0 2.6 2.6h10.2a2.6 2.6 0 0 0 2.6 -2.6v-5.6" />
      <path d="M4.3 15.3h-1.75a1.25 1.25 0 0 0 0 2.5h1.75" />
      <path d="M19.7 15.3h1.75a1.25 1.25 0 0 1 0 2.5h-1.75" />
    </svg>
  );
}

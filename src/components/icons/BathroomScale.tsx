import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Bathroom scale, a vector trace of the user's approved artwork
 * (public/icons/bathroom-scale.png: rounded frame, dial with needle, two
 * footprints). Drawn as a tabler-style stroke icon (viewBox trimmed to the
 * frame's outer edge so the icon fills its box without margin,
 * `currentColor`) instead of masking the PNG, because the 256px bitmap's
 * heavy lines blur into blobs at the 20–28px sizes the icon is used at.
 */
export function IconBathroomScale({
  size = 24,
  color = "currentColor",
  stroke = 2,
  className,
  ...rest
}: ComponentProps<Icon>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="2 2 20 20"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M7.5 6.5h9l-.9 2.4a1.6 1.6 0 0 1 -1.5 1.1h-4.2a1.6 1.6 0 0 1 -1.5 -1.1z" />
      <path
        d="M8.6 12.3c1.2 0 2 1.1 1.8 2.5l-.3 2.2c-.2 1.3 -.7 2.2 -1.5 2.2s-1.3 -.9 -1.5 -2.2l-.3 -2.2c-.2 -1.4 .6 -2.5 1.8 -2.5z"
        fill={color}
        stroke="none"
      />
      <path
        d="M15.4 12.3c1.2 0 2 1.1 1.8 2.5l-.3 2.2c-.2 1.3 -.7 2.2 -1.5 2.2s-1.3 -.9 -1.5 -2.2l-.3 -2.2c-.2 -1.4 .6 -2.5 1.8 -2.5z"
        fill={color}
        stroke="none"
      />
    </svg>
  );
}

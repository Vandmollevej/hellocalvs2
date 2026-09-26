import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Hand-authored icons for the weight-calibration conditions, in the tabler
 * outline style (24x24 viewBox, round caps/joins, `currentColor` stroke),
 * since tabler has no toilet, clothed/unclothed person or full/empty plate.
 */
function Svg({
  size = 24,
  color = "currentColor",
  stroke = 2,
  children,
  ...rest
}: ComponentProps<Icon> & { children: React.ReactNode }) {
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
      {...rest}
    >
      {children}
    </svg>
  );
}

function Toilet() {
  return (
    <>
      <path d="M4 4h4v7H4z" />
      <path d="M4 11h14v1a5 5 0 0 1 -5 5h-4a5 5 0 0 1 -5 -5z" />
      <path d="M9 17l-1 4h7l-1 -4" />
    </>
  );
}

/** Toilet with a check mark — "Efter toilet". */
export function IconToiletCheck(props: ComponentProps<Icon>) {
  return (
    <Svg {...props}>
      <Toilet />
      <path d="M12 5.5l2 2l4.5 -4.5" />
    </Svg>
  );
}

/** Toilet struck through — "Før toilet". */
export function IconToiletOff(props: ComponentProps<Icon>) {
  return (
    <Svg {...props}>
      <Toilet />
      <path d="M3 3l18 18" />
    </Svg>
  );
}

/** Person wearing a T-shirt and trousers — "Med tøj". */
export function IconPersonClothed(props: ComponentProps<Icon>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="3.5" r="2" />
      <path d="M9 7.5h6l4.5 3.5l-1.5 2l-2.5 -1.5v3.5h-7v-3.5l-2.5 1.5l-1.5 -2z" />
      <path d="M8.5 15l.5 7h2.5l.5 -4.5l.5 4.5h2.5l.5 -7" />
    </Svg>
  );
}

/** Bare stick-figure person — "Uden tøj". */
export function IconPersonUnclothed(props: ComponentProps<Icon>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="3.5" r="2" />
      <path d="M12 7v8" />
      <path d="M5.5 13l6.5 -5l6.5 5" />
      <path d="M8 22l4 -7l4 7" />
    </Svg>
  );
}

/** Plate seen from above with food on it — "Før mad". */
export function IconPlateFull(props: ComponentProps<Icon>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
      <circle cx="14.5" cy="11" r="1.5" fill="currentColor" />
      <circle cx="11" cy="14.5" r="1.5" fill="currentColor" />
    </Svg>
  );
}

/** Empty plate seen from above — "Efter mad". */
export function IconPlateEmpty(props: ComponentProps<Icon>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
    </Svg>
  );
}

import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Waist with a measuring tape — the "Kropsmål" (body measurements) icon.
 * These are the user's own drawings (public/icons/body-measurements/
 * waist-female.png and waist-male.png, 256 px copies of the uploaded
 * artwork: black lines on transparent). Rendered as a CSS mask so they take
 * `color` / `currentColor` like the tabler icons they sit beside. The PNGs
 * are used as-is; do not redraw them as SVG (see docs/DECISIONS.md
 * 2026-09-27). `stroke` is accepted for API compatibility and ignored.
 */
type WaistIconProps = ComponentProps<Icon> & { sex?: "FEMALE" | "MALE" | null };

/** Female figure for FEMALE, male figure otherwise (also when sex is unknown). */
export function IconWaistMeasure({
  sex,
  size = 24,
  color = "currentColor",
  className,
  style,
}: WaistIconProps) {
  const file = sex === "FEMALE" ? "waist-female" : "waist-male";
  const mask = `url(/icons/body-measurements/${file}.png) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: color,
        mask,
        WebkitMask: mask,
        ...style,
      }}
    />
  );
}

export function IconWaistMeasureFemale(props: ComponentProps<Icon>) {
  return <IconWaistMeasure {...props} sex="FEMALE" />;
}

export function IconWaistMeasureMale(props: ComponentProps<Icon>) {
  return <IconWaistMeasure {...props} sex="MALE" />;
}

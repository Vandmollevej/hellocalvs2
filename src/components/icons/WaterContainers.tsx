import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Hand-authored to match the tabler outline style (24x24 viewBox, round line
 * caps/joins, `currentColor` stroke), since tabler's set has no dedicated
 * "sports bottle" / "drinking glass" pair distinguishing size. Used only on
 * the water-logging page (docs/STATUS.md roadmap note, 2026-09-12) to pick a
 * container size, which then sets the ml slider automatically.
 */
function BottleBase({ size = 24, color = "currentColor", stroke = 2, neckWidth, ...rest }: ComponentProps<Icon> & { neckWidth: number }) {
  const halfNeck = neckWidth / 2;
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
      <path d={`M${12 - halfNeck} 2.5h${neckWidth}v3l1.5 2v12a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-12l1.5-2z`} />
      <path d="M8 12.5h8" />
    </svg>
  );
}

export function IconBottleLarge(props: ComponentProps<Icon>) {
  return <BottleBase neckWidth={3} {...props} />;
}

export function IconBottleSmall(props: ComponentProps<Icon>) {
  return <BottleBase neckWidth={2} {...props} />;
}

type GlassBaseProps = Omit<ComponentProps<Icon>, "height"> & { topWidth: number; height: number };

function GlassBase({ size = 24, color = "currentColor", stroke = 2, topWidth, height, ...rest }: GlassBaseProps) {
  const halfTop = topWidth / 2;
  const halfBottom = halfTop - 1.5;
  const top = (20 - height) / 2 + 1;
  const bottom = top + height;
  const fillTop = top + height * 0.3;
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
      <path
        d={`M${12 - halfTop} ${top}h${topWidth}l-${halfTop - halfBottom} ${height}h-${(halfTop - halfBottom) * 2}z`}
      />
      <path d={`M${12 - halfTop + 0.6} ${fillTop}h${topWidth - 1.2}`} />
      <path d={`M${12 - halfBottom} ${bottom}h${halfBottom * 2}`} />
    </svg>
  );
}

export function IconGlassLarge(props: Omit<ComponentProps<Icon>, "height">) {
  return <GlassBase topWidth={9} height={14} {...props} />;
}

export function IconGlassSmall(props: Omit<ComponentProps<Icon>, "height">) {
  return <GlassBase topWidth={7} height={10} {...props} />;
}

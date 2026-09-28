import type { FabSide } from "@/lib/frontpage-layout";

// Settings → Visning → Forside: small, static drawings of the front page's
// joystick wheel (green half-disk against the screen edge with the action
// circles fanned out around it, see AddButton.tsx). Purely illustrative —
// no data, no interaction.

const ARC_ANGLES = [-75, -37.5, 0, 37.5, 75];

function WheelShape({ cx, cy, diskRadius, arcRadius, circleRadius, mirror }: {
  cx: number;
  cy: number;
  diskRadius: number;
  arcRadius: number;
  circleRadius: number;
  mirror: boolean;
}) {
  const dir = mirror ? -1 : 1;
  return (
    <g>
      <path
        d={`M${cx},${cy - diskRadius} A${diskRadius},${diskRadius} 0 0 ${mirror ? 0 : 1} ${cx},${cy + diskRadius} Z`}
        fill="var(--hf-green)"
      />
      {ARC_ANGLES.map((deg) => {
        const theta = (deg * Math.PI) / 180;
        return (
          <circle
            key={deg}
            cx={cx + dir * arcRadius * Math.cos(theta)}
            cy={cy + arcRadius * Math.sin(theta)}
            r={circleRadius}
            fill="var(--hf-white)"
            stroke="var(--hf-black)"
            strokeWidth={1.2}
          />
        );
      })}
    </g>
  );
}

// Icon version for the "Knapper i hjulet" section heading.
export function WheelIcon({ size = 30 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={(size * 26) / 44} height={size} viewBox="0 -2 26 44" className="flex-none">
      <WheelShape cx={0} cy={20} diskRadius={9} arcRadius={17} circleRadius={3.4} mirror={false} />
    </svg>
  );
}

// Mini front page: wheel on the chosen side, number slider on the opposite.
export function FrontPagePreview({ side, selected = false }: { side: FabSide; selected?: boolean }) {
  const W = 72;
  const H = 110;
  const heroY = 44;
  const wheelLeft = side === "left";
  const sliderX = wheelLeft ? W - 26 : 8;
  return (
    <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-none">
      <defs>
        <clipPath id={`fpp-clip-${side}`}>
          <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={9} />
        </clipPath>
      </defs>
      <g clipPath={`url(#fpp-clip-${side})`}>
        <rect x={0} y={0} width={W} height={H} fill="var(--hf-color-page)" />
        <rect x={0} y={0} width={W} height={13} fill="var(--hf-green)" />
        <WheelShape
          cx={wheelLeft ? 0 : W}
          cy={heroY}
          diskRadius={9}
          arcRadius={17}
          circleRadius={3.2}
          mirror={!wheelLeft}
        />
        {/* Number slider: the centered value is bold, the neighbours faded. */}
        <rect x={sliderX + 3} y={heroY - 13} width={12} height={3} rx={1.5} fill="var(--hf-black)" opacity={0.25} />
        <rect x={sliderX} y={heroY - 3} width={18} height={6} rx={2} fill="var(--hf-black)" />
        <rect x={sliderX + 3} y={heroY + 10} width={12} height={3} rx={1.5} fill="var(--hf-black)" opacity={0.25} />
        <rect x={6} y={70} width={W - 12} height={10} rx={3} fill="var(--hf-tan)" />
        <rect x={6} y={83} width={W - 12} height={10} rx={3} fill="var(--hf-tan)" />
        <rect x={0} y={H - 11} width={W} height={11} fill="var(--hf-color-nav)" />
      </g>
      <rect
        x={0.5}
        y={0.5}
        width={W - 1}
        height={H - 1}
        rx={9}
        fill="none"
        stroke={selected ? "var(--hf-color-selected-border)" : "var(--hf-black)"}
        strokeOpacity={selected ? 1 : 0.35}
        strokeWidth={selected ? 1.5 : 1}
      />
    </svg>
  );
}

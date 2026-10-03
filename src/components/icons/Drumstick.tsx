import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Kyllingelår: brunt kød og hvidt ben. Kalenderens miniature-ikon for indtagne
 * kalorier (design.md §6.16). Farven på kødet er tokenet `--hf-meat`, benet er
 * hvidt med kødfarvet kant, så det står tydeligt på både creme og tan.
 * `color`/`stroke` accepteres for API-kompatibilitet med tabler-ikonerne, men
 * ikonet er altid tofarvet.
 */
export function IconDrumstick({ size = 24, className, style }: ComponentProps<Icon>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, ...style }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Ben: kødfarvet kant under det hvide, så kanten tegnes på én gang */}
      <g stroke="var(--hf-meat)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 10 19 5" strokeWidth={5.4} />
        <circle cx={18.9} cy={3.1} r={2.8} fill="var(--hf-meat)" strokeWidth={0.6} />
        <circle cx={20.9} cy={5.1} r={2.8} fill="var(--hf-meat)" strokeWidth={0.6} />
      </g>
      <g fill="var(--hf-white)" stroke="var(--hf-white)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 10 19 5" strokeWidth={3.2} />
        <circle cx={18.9} cy={3.1} r={1.9} strokeWidth={0} />
        <circle cx={20.9} cy={5.1} r={1.9} strokeWidth={0} />
      </g>
      {/* Kød: dråbeform, bred nederst til venstre og spids mod benet */}
      <path
        d="M14.6 9.4c2.2 2.9.3 8.4-3.9 11C6.2 23.2 1.4 19.6 2.3 14.4 3.2 9.2 10 6.6 14.6 9.4Z"
        fill="var(--hf-meat)"
      />
    </svg>
  );
}

import Image from "next/image";
import type { SVGProps } from "react";

/**
 * Konfettikanon — the calendar's marker for a målsætning's target date.
 * Small sizes use this solid silhouette (currentColor, so it follows the
 * surrounding text colour); larger views use the coloured PartyPopperImage.
 */
export function IconPartyPopper({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Cone */}
      <path d="M2.5 21.5L9 7.8Q13.4 9.6 16.2 15Z" strokeWidth={1} />
      {/* Star */}
      <path
        d="M17.5 1.3L18.32 3.37L20.54 3.51L18.83 4.93L19.38 7.09L17.5 5.9L15.62 7.09L16.17 4.93L14.46 3.51L16.68 3.37Z"
        strokeWidth={0.8}
      />
      {/* Streamers */}
      <g fill="none" strokeWidth={1.8}>
        <path d="M10.8 9.3c-1.5-2 1-3.5-0.5-6" />
        <path d="M12.8 10.8l2-2.4" />
        <path d="M14.3 12.9c1.6-1.4 2.6 0.2 4.1-1s1.2-2.2 3.1-2.3" />
      </g>
      {/* Confetti */}
      <circle cx="20.3" cy="14.4" r="1.3" stroke="none" />
      <rect x="4.6" y="4" width="2.4" height="2.4" rx="0.4" transform="rotate(-25 5.8 5.2)" stroke="none" />
    </svg>
  );
}

/** Coloured 3D konfettikanon for larger views (e.g. the target-date circle). */
export function PartyPopperImage({ size, className }: { size: number; className?: string }) {
  return (
    <Image
      src="/icons/party-popper.webp"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    />
  );
}

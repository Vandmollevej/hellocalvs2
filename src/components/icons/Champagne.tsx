import { useId, type ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Champagne bottle popping its cork, a vector trace of the user's approved
 * artwork for "Målsætning" (goals). Unlike the stroke icons this is a filled
 * silhouette, like the artwork: the label, the neck medallion and the foil
 * seam are cut out of the bottle with a mask so they show the background.
 * The viewBox is trimmed to the drawing (square, no margin) so it fills its
 * box at the 20–28px sizes it is used at. `stroke` is taken out of the
 * props (tabler passes a number) so it never lands on the <svg>.
 */
export function IconChampagne({
  size = 24,
  color = "currentColor",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stroke: _stroke,
  className,
  ...rest
}: ComponentProps<Icon>) {
  const maskId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="2.25 1.2 23 23"
      fill={color}
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <mask id={maskId}>
        <rect x="0" y="0" width="30" height="30" fill="white" />
        <g transform="translate(15.5 9.2) rotate(34.8)" fill="black" stroke="black" strokeWidth=".3">
          <rect x="-2.4" y="11" width="4.8" height="3.2" stroke="none" />
          <circle cx="0" cy="6.2" r="1.05" fill="none" />
          <path d="M-4 6.2H-1.05M1.05 6.2H4M-3 1.45H3" />
        </g>
      </mask>
      <g mask={`url(#${maskId})`}>
        <g transform="translate(15.5 9.2) rotate(34.8)">
          <rect x="-1.35" y="0" width="2.7" height="1.6" rx=".45" />
          <path d="M-1.15 1.5V4.4C-1.15 6.2 -3.1 7.2 -3.1 9.2V15.4a.7 .7 0 0 0 .7 .7H2.4a.7 .7 0 0 0 .7 -.7V9.2C3.1 7.2 1.15 6.2 1.15 4.4V1.5Z" />
        </g>
      </g>
      <path d="M19.6 2C20 1.4 20.5 1.1 21 1.3L22.2 1.9C22.8 2.2 23 2.8 22.6 3.4L22.2 3.8C22 4 21.8 3.9 21.6 3.7L20.6 5.1C20.4 5.4 20.1 5.4 19.8 5.2L19.2 4.8C18.9 4.5 18.9 4.3 19.1 4L19.9 2.8C19.5 2.6 19.4 2.3 19.6 2Z" />
      <path d="M13.93 4.25L14.2 4.45L14.46 4.68L14.71 4.92L14.93 5.18L15.13 5.46L15.32 5.76L15.48 6.06L15.61 6.38L15.72 6.71L15.8 7.04L15.85 7.39L15.87 7.74L15.86 8.09L15.81 8.44A0.2 0.2 0 0 0 16.19 8.56L16.32 8.18L16.42 7.79L16.47 7.39L16.5 6.99L16.48 6.58L16.43 6.17L16.35 5.76L16.23 5.36L16.08 4.96L15.9 4.57L15.69 4.2L15.45 3.83L15.17 3.48L14.87 3.15A0.72 0.72 0 0 0 13.93 4.25Z" />
      <path d="M16.02 2.39L16.18 2.65L16.32 2.91L16.44 3.18L16.56 3.45L16.65 3.73L16.74 4.01L16.8 4.3L16.85 4.59L16.89 4.89L16.91 5.19L16.91 5.5L16.9 5.82L16.87 6.13L16.83 6.45A0.17 0.17 0 0 0 17.17 6.55L17.28 6.22L17.38 5.9L17.46 5.57L17.53 5.24L17.58 4.9L17.61 4.57L17.62 4.23L17.62 3.89L17.6 3.54L17.55 3.2L17.49 2.85L17.41 2.5L17.31 2.16L17.18 1.81A0.65 0.65 0 0 0 16.02 2.39Z" />
      <path d="M18.1 5.34L17.99 5.67L17.88 5.98L17.78 6.26L17.67 6.53L17.57 6.78L17.46 7.02L17.35 7.25L17.25 7.47L17.14 7.69L17.03 7.91L16.91 8.13L16.8 8.34L16.68 8.57L16.56 8.8A0.17 0.17 0 0 0 16.84 9L17.02 8.81L17.19 8.63L17.36 8.45L17.53 8.27L17.7 8.09L17.87 7.9L18.05 7.7L18.22 7.49L18.39 7.27L18.57 7.03L18.75 6.77L18.93 6.49L19.11 6.19L19.3 5.86A0.65 0.65 0 0 0 18.1 5.34Z" />
      <path d="M22.14 5.75L21.76 5.78L21.4 5.84L21.05 5.93L20.71 6.04L20.38 6.18L20.07 6.34L19.78 6.52L19.49 6.71L19.22 6.92L18.97 7.14L18.72 7.36L18.49 7.6L18.28 7.83L18.08 8.08A0.17 0.17 0 0 0 18.32 8.32L18.56 8.14L18.81 7.96L19.07 7.8L19.33 7.64L19.6 7.5L19.87 7.37L20.15 7.26L20.43 7.16L20.71 7.09L20.98 7.03L21.26 7L21.53 6.99L21.8 7.01L22.06 7.05A0.65 0.65 0 0 0 22.14 5.75Z" />
      <path d="M22.11 9.64L21.8 9.31L21.46 9.05L21.09 8.85L20.72 8.71L20.34 8.62L19.95 8.58L19.57 8.59L19.19 8.63L18.82 8.71L18.47 8.83L18.12 8.97L17.79 9.14L17.49 9.34L17.2 9.56A0.17 0.17 0 0 0 17.4 9.84L17.69 9.7L18 9.58L18.31 9.48L18.63 9.41L18.94 9.37L19.25 9.37L19.56 9.39L19.84 9.44L20.11 9.52L20.36 9.63L20.58 9.77L20.77 9.94L20.94 10.14L21.09 10.36A0.63 0.63 0 0 0 22.11 9.64Z" />
      <circle cx="12.6" cy="5.7" r=".45" />
      <circle cx="14.8" cy="6.7" r=".4" />
      <circle cx="18.4" cy="3.3" r=".3" />
      <circle cx="23.2" cy="5.4" r=".45" />
      <circle cx="21.5" cy="8.2" r=".4" />
      <circle cx="18.6" cy="10.3" r=".3" />
    </svg>
  );
}

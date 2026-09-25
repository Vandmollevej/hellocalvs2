import type { ComponentProps, ReactNode } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Kropsmål: a torso with a measuring tape round the waist, vector traces of
 * the user's two approved drawings (woman and man). Simplified for 20–28px:
 * the tape is taller and keeps three ticks instead of seven, so the band does
 * not close up. Tabler-style stroke icons (`currentColor`), stroke 1.5 like
 * IconCookingPot. Pick the figure with `IconBodyMeasure` from the profile's
 * sex; unspecified falls back to the woman.
 */
function BodyIcon({
  size = 24,
  color = "currentColor",
  stroke = 1.5,
  className,
  children,
  ...rest
}: ComponentProps<Icon> & { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

export function IconBodyFemale(props: ComponentProps<Icon>) {
  return (
    <BodyIcon {...props}>
      <path d="M6.37 1.06L5.47 3.21C4.9 4.55 5.03 5.8 6.34 6.95C7.3 7.72 9.22 8.01 11.19 6.09" />
      <path d="M17.63 1.06L18.53 3.21C19.1 4.55 18.97 5.8 17.66 6.95C16.7 7.72 14.78 8.01 12.81 6.09" />
      <path d="M6.34 6.95C7.1 8.68 7.49 9.93 7.53 11.1" />
      <path d="M17.66 6.95C16.9 8.68 16.51 9.93 16.47 11.1" />
      <path d="M6.4 12C6.4 11.5 6.8 11.25 7.5 11.1" />
      <path d="M17.6 12C17.6 11.5 17.2 11.25 16.5 11.1" />
      <path d="M6.4 12Q12 14.4 17.6 12" />
      <path d="M6.4 14.8Q12 17.2 17.6 14.8" />
      <path d="M6.4 12V14.8" />
      <path d="M17.6 12V14.5" />
      <path d="M9.3 13.02v.9M12 13.3v.9M14.7 13.02v.9" />
      <path d="M16.8 15.9L17.5 18.6" />
      <path d="M7.2 15.9C6.9 16.6 6.5 17 5.95 17.6C4.5 19.4 4 21 4.95 22.9" />
      <path d="M16.8 15.9C17.1 16.6 17.5 17 18.05 17.6C19.5 19.4 20 21 19.05 22.9" />
    </BodyIcon>
  );
}

export function IconBodyMale(props: ComponentProps<Icon>) {
  return (
    <BodyIcon {...props}>
      <path d="M9.37 .56V1.09C9.37 1.77 8.99 2.21 8.45 2.44L6.91 3.21C6.43 3.4 6.05 3.3 5.57 3.44C4.13 3.78 3.36 5.03 3.36 6.66C3.36 7.53 3.65 8.1 4.03 8.68C3.9 9.54 3.8 10.41 3.84 11.17" />
      <path d="M14.63 .56V1.09C14.63 1.77 15.01 2.21 15.55 2.44L17.09 3.21C17.57 3.4 17.95 3.3 18.43 3.44C19.87 3.78 20.64 5.03 20.64 6.66C20.64 7.53 20.35 8.1 19.97 8.68C20.1 9.54 20.2 10.41 20.16 11.17" />
      <path d="M6.14 7.97C6.49 9.16 6.62 10.02 7.1 10.41C7.39 11.46 7.58 12.23 7.6 13.1" />
      <path d="M17.86 7.97C17.51 9.16 17.38 10.02 16.9 10.41C16.61 11.46 16.42 12.23 16.4 13.1" />
      <path d="M6.4 14C6.4 13.5 6.8 13.25 7.6 13.1" />
      <path d="M17.6 14C17.6 13.5 17.2 13.25 16.4 13.1" />
      <path d="M6.4 14Q12 16.4 17.6 14" />
      <path d="M6.4 16.8Q12 19.2 17.6 16.8" />
      <path d="M6.4 14V16.8" />
      <path d="M17.6 14V16.5" />
      <path d="M9.3 15.02v.9M12 15.3v.9M14.7 15.02v.9" />
      <path d="M16.8 17.9L17.3 20.2" />
      <path d="M7.2 17.9C7 18.6 6.7 19 6.3 19.6C5.6 20.6 5.4 22 5.6 23.4" />
      <path d="M16.8 17.9C17 18.6 17.3 19 17.7 19.6C18.4 20.6 18.6 22 18.4 23.4" />
      <path d="M11.62 23.4L12 21.3L12.38 23.4" />
    </BodyIcon>
  );
}

export function bodyMeasureIcon(sex: "FEMALE" | "MALE" | null | undefined) {
  return sex === "MALE" ? IconBodyMale : IconBodyFemale;
}

export function BodyMeasureIcon({
  sex,
  ...props
}: ComponentProps<Icon> & { sex: "FEMALE" | "MALE" | null | undefined }) {
  return sex === "MALE" ? <IconBodyMale {...props} /> : <IconBodyFemale {...props} />;
}

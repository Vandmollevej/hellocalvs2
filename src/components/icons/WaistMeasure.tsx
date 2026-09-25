import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Waist with a measuring tape, vector traces of the user's approved artwork
 * (public/icons/body-measurements/waist-female.png and waist-male.png).
 * Drawn as stroke icons (`currentColor`) instead of showing the 1254px PNGs,
 * which blur at the 20px size the icon is used at — same approach as
 * BathroomScale.tsx. Coordinates are in the PNGs' own pixel space; the tape
 * has fewer tick marks than the artwork so it stays legible when small.
 */
const FEMALE_PATHS = [
  "M338 80C290 175 270 230 272 280C275 370 350 432 440 430C510 428 560 395 605 345",
  "M916 80C964 175 984 230 982 280C979 370 904 432 814 430C744 428 694 395 649 345",
  "M332 420C362 480 390 560 395 620",
  "M922 420C892 480 864 560 859 620",
  "M362 640C372 610 390 600 395 620M892 640C882 610 864 600 859 620",
  "M366 648C450 690 804 690 888 648L892 728C804 770 450 770 362 728Z",
  "M470 696V734M580 704V744M690 704V744M800 696V734",
  "M836 756L878 905L942 885L900 740",
  "M383 748C350 820 290 860 262 940C228 1030 228 1110 256 1175",
  "M871 748C904 820 964 860 992 940C1026 1030 1026 1110 998 1175",
];

const MALE_PATHS = [
  "M487 40C492 95 470 120 440 132L360 172C330 186 300 170 250 195C190 225 176 300 180 360C184 405 200 430 212 455C200 510 194 550 200 588",
  "M767 40C762 95 784 120 814 132L894 172C924 186 954 170 1004 195C1064 225 1078 300 1074 360C1070 405 1054 430 1042 455C1054 510 1060 550 1054 588",
  "M318 415C335 490 350 520 368 542C390 612 400 680 400 725",
  "M936 415C919 490 904 520 886 542C864 612 854 680 854 725",
  "M340 700C340 670 480 655 627 655C774 655 914 670 914 700V742C914 790 774 822 627 822C480 822 340 790 340 742Z",
  "M358 735C450 765 804 765 896 735",
  "M460 762V784M580 768V792M700 768V792M810 762V784",
  "M375 800C370 880 340 930 310 975C275 1030 265 1150 290 1220",
  "M879 800C884 880 914 930 944 975C979 1030 989 1150 964 1220",
  "M600 1220L627 1100L655 1220",
  "M886 792C912 800 930 830 938 860L955 905L912 915",
];

type WaistIconProps = ComponentProps<Icon> & { sex?: "FEMALE" | "MALE" | null };

/** Female figure for FEMALE, male figure otherwise (also when sex is unknown). */
export function IconWaistMeasure({
  sex,
  size = 24,
  color = "currentColor",
  stroke = 2,
  className,
  ...rest
}: WaistIconProps) {
  const female = sex === "FEMALE";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={female ? "52 40 1150 1150" : "27 30 1200 1200"}
      fill="none"
      stroke={color}
      // 30 source px per tabler stroke unit: stroke 2 matches the 20px row icons.
      strokeWidth={Number(stroke) * 30}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {(female ? FEMALE_PATHS : MALE_PATHS).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function IconWaistMeasureFemale(props: ComponentProps<Icon>) {
  return <IconWaistMeasure {...props} sex="FEMALE" />;
}

export function IconWaistMeasureMale(props: ComponentProps<Icon>) {
  return <IconWaistMeasure {...props} sex="MALE" />;
}

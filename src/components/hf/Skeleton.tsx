"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";

/*
 * Skelet-loading (design.md §6.14): mens en side henter data, tegnes
 * indholdets form som flader med en løbende gradient — som HelloFresh's
 * "Opdag"-side. Brug altid disse primitiver i stedet for en "Henter…"-tekst.
 *
 * - <Skeleton type="body" /> tegner én flade i præcis tekstrollens mål.
 * - Mønstrene (SkeletonList, SkeletonForm, …) dækker de faste sidetyper.
 * - <LoadingScope loading> lader en side tegne sin rigtige struktur med
 *   pladsholdertekst; alle .hf-type-*-tekster, knapper og [data-skeleton]
 *   bliver automatisk til skitser (se globals.css).
 */

/** Skal matche --hf-skeleton-duration i globals.css. */
const SKELETON_SHIMMER_MS = 1400;

/** Lægger animationen på et fælles ur, så alle skeletter på skærmen står i
 * samme fase, også når de monteres på forskellige tidspunkter. */
function syncShimmerPhase(element: HTMLElement | null) {
  if (!element) return;
  const phase = Math.round(performance.now() % SKELETON_SHIMMER_MS);
  element.style.setProperty("--hf-skeleton-delay", `-${phase}ms`);
}

type Size = number | string;

/* Højde og form pr. type. Tekstroller bruger rollens linjehøjde (design.md §4.2). */
const TYPES = {
  hero: { height: 38, text: true },
  "page-title": { height: 29, text: true },
  "card-title": { height: 24, text: true },
  "body-lg": { height: 29, text: true },
  body: { height: 25, text: true },
  "body-sm": { height: 22, text: true },
  caption: { height: 18, text: true },
  label: { height: 16, text: true },
  button: { height: 48, text: false },
  field: { height: 48, text: false },
  row: { height: 48, text: false },
  card: { height: 96, text: false },
  image: { height: 160, text: false },
  tile: { height: 72, text: false },
  chip: { height: 32, text: true },
  circle: { height: 40, text: false },
  icon: { height: 20, text: false },
} as const;

export type SkeletonType = keyof typeof TYPES;

function toCss(size: Size | undefined) {
  return typeof size === "number" ? `${size}px` : size;
}

export function Skeleton({
  type = "body",
  width,
  height,
  className = "",
  style,
}: {
  type?: SkeletonType;
  width?: Size;
  height?: Size;
  className?: string;
  style?: CSSProperties;
}) {
  const spec = TYPES[type];
  const isCircle = type === "circle" || type === "icon";
  const resolvedHeight = height ?? spec.height;
  const resolvedWidth = width ?? (isCircle ? resolvedHeight : spec.text ? "60%" : "100%");
  return (
    <span
      ref={syncShimmerPhase}
      aria-hidden
      className={`hf-skeleton ${spec.text ? "hf-skeleton--text" : ""} ${
        type === "circle" ? "hf-skeleton--circle" : ""
      } ${className}`}
      style={{ width: toCss(resolvedWidth), height: toCss(resolvedHeight), ...style }}
    />
  );
}

/* Faste, varierende linjebredder, så en tekstblok ikke ligner en mur. */
const LINE_WIDTHS = ["92%", "78%", "86%", "64%", "88%", "70%"];

export function SkeletonText({
  lines = 3,
  type = "body",
  lastWidth = "48%",
}: {
  lines?: number;
  type?: "body-lg" | "body" | "body-sm" | "caption";
  lastWidth?: string;
}) {
  return (
    <span className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          type={type}
          width={index === lines - 1 && lines > 1 ? lastWidth : LINE_WIDTHS[index % LINE_WIDTHS.length]}
        />
      ))}
    </span>
  );
}

/** Sektionsoverskrift "──── Tekst ────" med stregerne og den faste afstand
 * fra .hf-type-section-title; kun teksten er en skitse. */
export function SkeletonSectionTitle({ width = 96 }: { width?: Size }) {
  return (
    <div className="hf-type-section-title" aria-hidden>
      <Skeleton type="body-sm" width={width} height={20} />
    </div>
  );
}

/** Tilgængelig ramme om et skelet: skærmlæsere hører "Henter…", og siden
 * får samme gutter/rytme som den færdige .hf-page. */
export function SkeletonScreen({
  children,
  className = "hf-page",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{t("common.loading")}</span>
      {children}
    </div>
  );
}

/** Tegner børnene som skitse, mens loading er sand. Pladsholdertekst i
 * .hf-type-*-elementer bestemmer boksenes bredde. */
export function LoadingScope({
  loading,
  children,
  className,
}: {
  loading: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      ref={loading ? syncShimmerPhase : undefined}
      data-hf-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      className={className}
    >
      {children}
    </div>
  );
}

/* ---- Faste sidemønstre ---- */

const ROW_WIDTHS = ["58%", "44%", "66%", "50%", "38%", "62%", "54%", "46%"];
const LABEL_WIDTHS = ["28%", "22%", "34%", "25%"];

/** Indstillings-/menuliste: kort med 48 px-rækker (ikon, tekst, pil). */
export function SkeletonList({ rows = 5, icons = true }: { rows?: number; icons?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[8px] bg-hf-tan" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`flex h-12 items-center gap-4 px-4 ${
            index < rows - 1 ? "border-b border-hf-tan-dark" : ""
          }`}
        >
          {icons && <Skeleton type="icon" />}
          <Skeleton type="body" width={ROW_WIDTHS[index % ROW_WIDTHS.length]} height={18} />
        </div>
      ))}
    </div>
  );
}

/** Stak af selvstændige kort/poster (historik, beskeder, mål). */
export function SkeletonCards({
  count = 3,
  height = 88,
  gap = 8,
  radius = 8,
}: {
  count?: number;
  height?: Size;
  gap?: number;
  radius?: number;
}) {
  return (
    <div className="flex flex-col" style={{ gap }} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} type="card" height={height} style={{ borderRadius: radius }} />
      ))}
    </div>
  );
}

/** Formular: label over 48 px-felt, som TextField. */
export function SkeletonForm({ fields = 4, button = false }: { fields?: number; button?: boolean }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1">
          <Skeleton type="label" width={LABEL_WIDTHS[index % LABEL_WIDTHS.length]} />
          <Skeleton type="field" />
        </div>
      ))}
      {button && <Skeleton type="button" className="mt-4" />}
    </div>
  );
}

/** Gitter af billedkort med titel og undertekst (opskrifter, madvarer). */
export function SkeletonGrid({ count = 4, imageHeight = 140 }: { count?: number; imageHeight?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton type="image" height={imageHeight} />
          <Skeleton type="body-sm" width="90%" />
          <Skeleton type="caption" width="55%" />
        </div>
      ))}
    </div>
  );
}

/** FoodRow-rækker: 44 px-miniature, titel og undertekst, skillelinje
 * imellem (madvarer, dagens registreringer, søgeresultater). */
export function SkeletonMediaRows({
  rows = 6,
  thumb = true,
  className = "",
}: {
  rows?: number;
  thumb?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`} aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`flex items-center gap-2.5 py-2.5 ${
            index < rows - 1 ? "border-b border-hf-tan-dark" : ""
          }`}
        >
          {thumb && <Skeleton type="tile" width={44} height={44} />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton type="body-sm" width={ROW_WIDTHS[index % ROW_WIDTHS.length]} height={14} />
            <Skeleton type="caption" width="34%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Detaljeside: stort billede, titel og brødtekst. */
export function SkeletonDetail({ image = true }: { image?: boolean }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {image && <Skeleton type="image" height={220} />}
      <Skeleton type="page-title" width="70%" />
      <SkeletonText lines={3} />
      <SkeletonCards count={2} height={72} />
    </div>
  );
}

/** Toggle-kort (components/ui/Toggle.tsx): label, beskrivelse og kontakt. */
export function SkeletonToggle({ count = 1 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-2xl bg-hf-tan px-4 py-4">
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton type="body-sm" width={ROW_WIDTHS[index % ROW_WIDTHS.length]} height={18} />
            <Skeleton type="caption" width="88%" height={12} />
            <Skeleton type="caption" width="62%" height={12} />
          </span>
          <Skeleton type="chip" width={40} height={24} className="mt-1" />
        </div>
      ))}
    </div>
  );
}

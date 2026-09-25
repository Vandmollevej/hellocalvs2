import Link from "next/link";
import type { ComponentProps } from "react";

// Fælles handlingsknap (design.md §6.2): almindelige primære og sekundære
// handlinger fylder altid hele indholdsbredden — ingen smalle, centrerede
// knapper. Ikonknapper, +/−, luk/tilbage og små inline-kontroller bruger ikke
// denne komponent. Udseendet (højde, kant, radius, typografi) er uændret og
// kommer fra .hf-btn-primary/.hf-btn-secondary samt `className`.
type Variant = "primary" | "secondary";

function actionClass(variant: Variant, className?: string) {
  return `hf-btn-${variant} w-full ${className ?? ""}`.trim();
}

export function ActionButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={actionClass(variant, className)} {...props} />;
}

export function ActionLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={actionClass(variant, className)} {...props} />;
}

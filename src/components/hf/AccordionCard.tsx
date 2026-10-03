import Link from "next/link";
import { HfChevron } from "@/components/hf/HfChevron";

export function AccordionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[8px] bg-hf-tan">{children}</div>
  );
}

export function ChevronRow({
  icon,
  label,
  divider = true,
  href,
  onClick,
  badgeCount,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  divider?: boolean;
  href?: string;
  onClick?: () => void;
  // Ulæst-tal (fx Profil → Beskeder): grøn cirkel med hvidt tal (ejerens valg
  // 2026-10-03). Sidder til venstre for pilen, yderst til højre i rækken.
  badgeCount?: number;
  // Fed grøn række (fx Profil → Kontoopsætning): ikon og tekst i brand-grøn.
  emphasis?: boolean;
}) {
  const className = `flex h-12 w-full items-center gap-4 px-4 text-left ${
    divider ? "border-b border-hf-tan-dark" : ""
  }`;
  const content = (
    <>
      <span
        className="flex h-5 w-5 items-center justify-center text-hf-black"
        style={emphasis ? { color: "var(--hf-color-brand)" } : undefined}
      >
        {icon}
      </span>
      <span
        className={`hf-type-body flex-1 truncate ${emphasis ? "hf-type-strong" : ""}`}
        style={emphasis ? { color: "var(--hf-color-brand)" } : undefined}
      >
        {label}
      </span>
      {!!badgeCount && badgeCount > 0 && (
        <span
          className="hf-type-caption flex h-5 min-w-5 items-center justify-center rounded-full px-1"
          style={{ background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }}
          aria-label={`${badgeCount} ulæste`}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      <HfChevron className="text-hf-black" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

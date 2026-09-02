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
}: {
  icon: React.ReactNode;
  label: string;
  divider?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className = `flex h-12 w-full items-center gap-4 px-4 text-left ${
    divider ? "border-b border-hf-tan-dark" : ""
  }`;
  const content = (
    <>
      <span className="flex h-5 w-5 items-center justify-center text-hf-black">{icon}</span>
      <span className="hf-type-body flex-1 truncate">{label}</span>
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

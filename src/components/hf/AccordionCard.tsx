import Link from "next/link";

export function AccordionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-hf-tan">{children}</div>
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
  const className = `flex w-full items-center gap-3 px-4 py-4 text-left ${
    divider ? "border-b border-hf-tan-dark" : ""
  }`;
  const content = (
    <>
      <span className="text-hf-black">{icon}</span>
      <span className="flex-1 text-[15px] font-medium text-hf-black">
        {label}
      </span>
      <span className="text-hf-black">›</span>
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

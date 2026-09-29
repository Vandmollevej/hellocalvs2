import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";

// Liste i samme blok-stil som profilsiden; hver række åbner en ny side.
export function KnowledgeRows({
  rows,
  icon,
  empty = "Ingen resultater.",
}: {
  rows: { key: string; label: string; href: string }[];
  icon: React.ReactNode;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="hf-type-body text-text-secondary">{empty}</p>;
  return (
    <AccordionCard>
      {rows.map((row, index) => (
        <ChevronRow key={row.key} icon={icon} label={row.label} href={row.href} divider={index < rows.length - 1} />
      ))}
    </AccordionCard>
  );
}

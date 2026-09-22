import { SectionSeparator } from "@/components/hf/SectionSeparator";

// Dato-separator: samme globale separator som TIDSPUNKT (SectionSeparator).
export function DateSeparator({ label }: { label: string }) {
  return <SectionSeparator label={label} />;
}

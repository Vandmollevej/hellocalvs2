import type { ReactNode } from "react";

// Fælles byggeklodser til de juridiske sider (/betingelser, /privatlivspolitik).

export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-20">
      <h2 className="hf-type-section-title">{title}</h2>
      <div className="hf-type-body-sm mt-2 flex flex-col gap-2 opacity-90">{children}</div>
    </section>
  );
}

// "Kort fortalt"-boks øverst: det brugeren bør vide, uden at læse det hele.
export function LegalSummary({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <div className="mt-4 rounded-2xl bg-hf-tan px-4 py-4">
      <p className="hf-type-section-title">{title}</p>
      <ul className="hf-type-body-sm mt-2 flex list-disc flex-col gap-1.5 pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// Fremhævet løfte midt i teksten.
export function LegalPromise({ children }: { children: ReactNode }) {
  return <p className="border-l-4 border-hf-green pl-3 font-semibold">{children}</p>;
}

// Firmaoplysninger, der endnu ikke er udfyldt, vises tydeligt.
export function Placeholder({ children }: { children: ReactNode }) {
  return <span className="rounded bg-yellow-200 px-1 font-semibold">[{children}]</span>;
}

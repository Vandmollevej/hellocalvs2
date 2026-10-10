"use client";

import { useId, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";

// Byggeklodserne øverst på en opskrift i HelloFresh-stil. Klasserne ligger
// i recipe-view.css (importeret af RecipeViewScreen).

export function RecipeTitle({ name, headline }: { name: string; headline: string | null }) {
  return (
    <div>
      <h1 className="rv-title">{name}</h1>
      {headline && <p className="rv-headline">{headline}</p>}
    </div>
  );
}

export type RecipeMetaItem = { key: string; label: string; icon: React.ReactNode; value: string };

export function RecipeMeta({ items }: { items: RecipeMetaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rv-meta">
      {items.map((item) => (
        <div key={item.key}>
          <p className="rv-meta-label">{item.label}</p>
          <p className="rv-meta-value">
            {item.icon}
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function RecipeTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="rv-tags">
      {tags.map((tag) => (
        <span key={tag} className="rv-tag">
          {tag}
        </span>
      ))}
    </div>
  );
}

export function RecipeActions({ children }: { children: React.ReactNode }) {
  return <div className="rv-actions">{children}</div>;
}

export function RecipeDescription({
  title,
  text,
  readMore,
  readLess,
}: {
  title: string;
  text: string;
  readMore: string;
  readLess: string;
}) {
  const [expanded, setExpanded] = useState(false);
  // Korte beskrivelser vises hele uden "Læs mere".
  const long = text.length > 160;
  return (
    <section className="rv-description">
      <h2 className="rv-section-title">{title}</h2>
      <p className={`rv-description-text ${long && !expanded ? "rv-description-text--clamped" : ""}`}>{text}</p>
      {long && (
        <button type="button" className="rv-read-more rv-no-print" onClick={() => setExpanded((open) => !open)}>
          {expanded ? readLess : readMore}
        </button>
      )}
    </section>
  );
}

export function RecipeAllergens({ label, names, note }: { label: string; names: string[]; note?: string }) {
  return (
    <>
      {names.length > 0 && (
        <p className="rv-allergens">
          <span className="rv-allergens-label">{label}</span>
          {names.join(" • ")}
        </p>
      )}
      {note && <p className="rv-allergen-note">{note}</p>}
    </>
  );
}

export function RecipeAccordion({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = useId();
  return (
    <section id={id} className="rv-accordion">
      <button type="button" className="rv-accordion-toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="rv-section-title" role="heading" aria-level={2}>
          {title}
        </span>
        <HfChevron direction={open ? "up" : "down"} className="rv-accordion-chevron" />
      </button>
      <div id={panelId} hidden={!open} className="rv-accordion-panel">
        {children}
      </div>
    </section>
  );
}

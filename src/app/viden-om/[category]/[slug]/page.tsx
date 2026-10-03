"use client";

import { notFound, useParams } from "next/navigation";
import { IconBook, IconExternalLink } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { getKnowledgeArticle } from "@/lib/knowledge";
import { FOOD_TERMS, foodTermAnchor } from "@/lib/food-latin";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-hf-tan p-4">
      <p className="hf-type-small text-text-secondary hf-heading uppercase">{title}</p>
      <div className="hf-type-body mt-1 flex flex-col gap-2 text-hf-black">{children}</div>
    </section>
  );
}

function Source({ label, href }: { label: string; href: string }) {
  return (
    <Section title="Kilde">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-hf-green underline underline-offset-2"
      >
        {label} <IconExternalLink size={14} />
      </a>
    </Section>
  );
}

// Én side pr. artikel eller ord, så popups kan linke direkte hertil.
export default function KnowledgeEntryPage() {
  const { category, slug } = useParams<{ category: string; slug: string }>();

  if (category === "mad-paa-latin") {
    const term = FOOD_TERMS.find((item) => foodTermAnchor(item.term) === slug);
    if (!term) notFound();
    return (
      <HfScreen title={term.term} icon={<IconBook size={20} stroke={2} />} alwaysShowBackButton>
        <div className="hf-page flex flex-col gap-3">
          <Section title="På dansk">
            <p className="hf-heading">{term.danish}</p>
          </Section>
          <Section title="Forklaring">
            <p>{term.explanation}</p>
          </Section>
          <Source {...term.source} />
        </div>
      </HfScreen>
    );
  }

  const article = getKnowledgeArticle(slug);
  if (!article || article.category !== category) notFound();
  return (
    <HfScreen title={article.title} icon={<IconBook size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        <Section title="Kort fortalt">
          <p className="hf-heading">{article.summary}</p>
        </Section>
        <Section title="Forklaring">
          {article.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </Section>
        {article.funFact && (
          <Section title="Fun fact">
            <p>{article.funFact}</p>
          </Section>
        )}
        <Source {...article.source} />
      </div>
    </HfScreen>
  );
}

// Fælles indeks for "Viden om mad": kategorier og deres opslag (artikler og
// "Mad på latin"-ord), så hver post har sin egen side /viden-om/<kategori>/<slug>.
import { KNOWLEDGE_ARTICLES, type KnowledgeArticle } from "@/lib/knowledge";
import { FOOD_TERMS, foodTermAnchor, matchesFoodTerm } from "@/lib/food-latin";

export type KnowledgeSection = "vitaminer" | "sundhedstips" | "mad-paa-latin";

export const KNOWLEDGE_SECTIONS: { id: KnowledgeSection | "e-numre"; title: string }[] = [
  { id: "vitaminer", title: "Vitaminer" },
  { id: "e-numre", title: "E-numre" },
  { id: "sundhedstips", title: "Sundhedstips" },
  { id: "mad-paa-latin", title: "Mad på latin" },
];

export type KnowledgeEntry = { section: KnowledgeSection; slug: string; title: string; subtitle: string };

export function sectionTitle(id: string): string | undefined {
  return KNOWLEDGE_SECTIONS.find((section) => section.id === id)?.title;
}

export function entryHref(section: string, slug: string): string {
  return `/viden-om/${section}/${slug}`;
}

export function listEntries(section: KnowledgeSection): KnowledgeEntry[] {
  if (section === "mad-paa-latin") {
    return [...FOOD_TERMS]
      .sort((a, b) => a.term.localeCompare(b.term, "da"))
      .map((term) => ({ section, slug: foodTermAnchor(term.term), title: term.term, subtitle: term.danish }));
  }
  return KNOWLEDGE_ARTICLES.filter((article) => article.category === section).map((article) => ({
    section,
    slug: article.slug,
    title: article.title,
    subtitle: article.summary,
  }));
}

function articleMatches(article: KnowledgeArticle, q: string) {
  return [article.title, article.summary, article.funFact ?? "", ...article.body].some((text) =>
    text.toLowerCase().includes(q),
  );
}

export function searchEntries(query: string, section?: KnowledgeSection): KnowledgeEntry[] {
  const q = query.trim().toLowerCase();
  const sections: KnowledgeSection[] = section ? [section] : ["vitaminer", "sundhedstips", "mad-paa-latin"];
  return sections.flatMap((id) =>
    listEntries(id).filter((entry) => {
      if (!q) return true;
      if (id === "mad-paa-latin") {
        const term = FOOD_TERMS.find((item) => foodTermAnchor(item.term) === entry.slug);
        return !!term && matchesFoodTerm(term, q);
      }
      const article = KNOWLEDGE_ARTICLES.find((item) => item.slug === entry.slug);
      return !!article && articleMatches(article, q);
    }),
  );
}

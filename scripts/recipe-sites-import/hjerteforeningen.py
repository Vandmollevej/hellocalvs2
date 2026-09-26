"""Scrape every recipe on hjerteforeningen.dk. Run: python hjerteforeningen.py

The pages have no Recipe JSON-LD, so the recipe is read from the page. The
site shows energy and macros per person, which are saved as site nutrition.
"""

from recipe_sites_common import SiteConfig, main

DOM_EXTRACT_JS = r"""
() => {
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const list = document.querySelector('.ingredient-list');
  if (!list) return null;
  const lines = [];
  let section = '';
  list.querySelectorAll('h3, li').forEach((el) => {
    if (el.tagName === 'H3') { section = text(el); return; }
    const raw = text(el);
    if (raw) lines.push({ section, raw });
  });
  const steps = [];
  document.querySelectorAll('.elementor-widget-text-editor').forEach((block) => {
    if (!/tilberedning|fremgangsm/i.test(text(block.querySelector('h2, h3')))) return;
    block.querySelectorAll('p, li').forEach((p) => { const t = (p.innerText || '').replace(/\n+/g, ': ').replace(/\s+/g, ' ').trim(); if (t) steps.push(t); });
  });
  const grams = (label) => {
    const box = [...document.querySelectorAll('.energy-type-container')].find((b) => text(b.querySelector('h4')).toLowerCase() === label);
    return box ? text(box.querySelector('span')) : '';
  };
  const kcal = text(document.querySelector('.energy-split-container .kcal-container'));
  const img = document.querySelector('.hf-post-header img.featured-image');
  const category = text(document.querySelector('.hf-post-header .text-section-wrapper span'));
  const tags = [...document.querySelector('.elementor-location-single')?.classList || []]
    .filter((c) => c.startsWith('global-tag-')).map((c) => c.replace('global-tag-', '').replace(/-/g, ' '));
  const toNumber = (t) => { const m = (t || '').replace(',', '.').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
  const description = text(document.querySelector('meta[name="description"]') ? { textContent: document.querySelector('meta[name="description"]').content } : null);
  return {
    name: text(document.querySelector('h1')),
    description,
    yield: text(document.querySelector('.ingredient-list-container > p')),
    total: '', work: '',
    categories: [category, ...tags].filter(Boolean),
    keywords: [],
    lines,
    steps,
    image: img ? img.src : '',
    nutrition: kcal ? {
      basis: 'pr. person',
      kcal: toNumber(kcal),
      protein: toNumber(grams('protein')),
      carbs: toNumber(grams('kulhydrat')),
      fat: toNumber(grams('fedt')),
    } : {},
    crumbs: [],
  };
}
"""

SITE = SiteConfig(
    retailer="hjerteforeningen",
    display_name="Hjerteforeningen",
    folder="Hjerteforeningen",
    host="hjerteforeningen.dk",
    recipe_url_re=r"^https://hjerteforeningen\.dk/opskrifter/alle-opskrifter/[a-z0-9-]+/$",
    # The recipe overview links every recipe on one page.
    plain_listings=["https://hjerteforeningen.dk/sundhed/opskrifter/"],
    trailing_slash=True,
    dom_extract_js=DOM_EXTRACT_JS,
)

if __name__ == "__main__":
    main(SITE)

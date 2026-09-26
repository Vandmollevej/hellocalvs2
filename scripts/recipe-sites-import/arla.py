"""Scrape every recipe on arla.dk/opskrifter. Run: python arla.py"""

from recipe_sites_common import SiteConfig, main

SITE = SiteConfig(
    retailer="arla",
    display_name="Arla",
    folder="Arla",
    host="www.arla.dk",
    recipe_url_re=r"^https://www\.arla\.dk/opskrifter/[a-z0-9-]+/$",
    # Inspiration pages ("madpakker-til-born", "aftensmad", "desserter", ...)
    # give each recipe a category before the full list is walked.
    category_roots=["https://www.arla.dk/opskrifter/", "https://www.arla.dk/opskrifter/inspiration/madpakker-til-born/"],
    category_url_re=r"^https://www\.arla\.dk/opskrifter/inspiration/[a-z0-9-]+/$",
    paged_listings=[("alle", lambda n: "https://www.arla.dk/opskrifter/" + (f"?page={n}" if n > 1 else ""))],
    trailing_slash=True,
    ignore_slugs={"meal-prep", "indkobsliste", "click-and-cook", "arla-inspirationskokken", "leksikon",
                  "ravarekalender", "artikler", "inspiration"},
)

if __name__ == "__main__":
    main(SITE)

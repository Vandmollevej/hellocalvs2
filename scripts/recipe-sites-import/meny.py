"""Scrape the recipes on meny.dk. Run: python meny.py

meny.dk/opskrifter only shows the newest recipes. With a filter selected
(Børnekok, Madpakke, Dessert, Hovedret, ...) the list gets a "Hent flere
opskrifter" button, so every filter is opened and expanded in turn. The
filter name becomes the recipe's category. Related-recipe links on each
recipe page are followed too.
"""

from playwright.sync_api import Page

from recipe_sites_common import SiteConfig, main


def filter_listings(page: Page) -> list[tuple[str, str]]:
    # The filter checkboxes carry the filter name as title and its id as value;
    # checking one opens /opskrifter?categoryids=<value>.
    filters = page.evaluate(
        """() => [...document.querySelectorAll('input[type=checkbox]')]
             .filter((i) => !i.name.startsWith('cookie') && i.title && i.value)
             .map((i) => [i.title, i.value])"""
    )
    seen: set[str] = set()
    result = []
    for title, value in filters:
        if value not in seen:
            seen.add(value)
            result.append((title, f"https://meny.dk/opskrifter?categoryids={value}"))
    return result


SITE = SiteConfig(
    retailer="meny",
    display_name="MENY",
    folder="MENY",
    host="meny.dk",
    recipe_url_re=r"^https://meny\.dk/opskrift/[a-z0-9-]+$",
    plain_listings=["https://meny.dk/opskrifter"],
    filter_listings=filter_listings,
    load_more_label=r"hent flere opskrifter",
)

if __name__ == "__main__":
    main(SITE)

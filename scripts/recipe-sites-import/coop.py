"""Scrape every recipe on opskrifter.coop.dk. Run: python coop.py"""

from recipe_sites_common import SiteConfig, main

LETTERS = "abcdefghijklmnopqrstuvwxyzæøå"


def letter_listing(letter: str):
    return (f"alle-{letter}", lambda n: f"https://opskrifter.coop.dk/alle-opskrifter?q={letter}&page={n}")


SITE = SiteConfig(
    retailer="coop",
    display_name="Coop",
    folder="Coop",
    host="opskrifter.coop.dk",
    recipe_url_re=r"^https://opskrifter\.coop\.dk/opskrifter/[a-z0-9-]+-\d+$",
    # Theme pages ("boernevenlig-aftensmad", "frokost", ...) first.
    category_roots=["https://opskrifter.coop.dk/temaer", "https://opskrifter.coop.dk/"],
    category_url_re=r"^https://opskrifter\.coop\.dk/temaer/[a-z0-9-]+$",
    # "Alle opskrifter" is split by first letter, each with numbered pages.
    paged_listings=[letter_listing(letter) for letter in LETTERS],
)

if __name__ == "__main__":
    main(SITE)

"""Scrape every recipe on madogdrikke.rema1000.dk/opskrifter. Run: python rema1000.py"""

from recipe_sites_common import SiteConfig, main

BASE = "https://madogdrikke.rema1000.dk/opskrifter"

SITE = SiteConfig(
    retailer="rema1000",
    display_name="REMA 1000",
    folder="REMA1000",
    host="madogdrikke.rema1000.dk",
    recipe_url_re=r"^https://madogdrikke\.rema1000\.dk/opskrifter/[A-Za-z0-9-]+$",
    # Theme pages (aftensmad, frokost, mad-for-born, ...) are single-segment
    # URLs like recipes. They have no recipe, so the scraper treats them as a
    # listing and labels their recipes with the theme name.
    category_roots=[f"{BASE}/temaer", BASE],
    category_url_re=r"^https://madogdrikke\.rema1000\.dk/opskrifter/(aftensmad|frokost|morgenmad|bagvaerk-sodt-og-snacks|"
                    r"forretter|tilbehor-til-aftensmad|fest-og-hojtider|mad-for-born|nem-hverdagsmad|mad-pa-farten|"
                    r"sundere-alternativer|drikkevarer|glutenfri|kodfri|nemt-og-gront|fisk-og-skaldyr|vildt|udenlandsk|saesonmad)$",
    paged_listings=[("alle", lambda n: f"{BASE}/alle" + (f"/{n}" if n > 1 else ""))],
    ignore_slugs={"alle", "temaer"},
)

if __name__ == "__main__":
    main(SITE)

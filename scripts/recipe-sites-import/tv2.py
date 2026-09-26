"""Scrape the recipes on livsstil.tv2.dk/mad/opskrifter. Run: python tv2.py

The listing grows with a "Vis flere" button, which is clicked until it
disappears; related-recipe links on each recipe page are followed too.
"""

from recipe_sites_common import SiteConfig, main

SITE = SiteConfig(
    retailer="tv2",
    display_name="TV 2",
    folder="TV2",
    host="livsstil.tv2.dk",
    recipe_url_re=r"^https://livsstil\.tv2\.dk/mad/opskrift/[a-z0-9-]+$",
    plain_listings=["https://livsstil.tv2.dk/mad/opskrifter"],
    load_more_label=r"^\s*vis flere\s*$",
)

if __name__ == "__main__":
    main(SITE)

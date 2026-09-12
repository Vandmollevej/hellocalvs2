"""
One-off backfill for HelloFresh dish images that failed to download on their
original import.

Root cause (see agent.py's `already_up_to_date`): once a recipe has been
imported, the agent skips it on every later poll as long as its sitemap
`lastmod` hasn't changed — even if that first import's image download failed
and left `imageUrl` NULL. A failed image is therefore never retried by the
normal poll loop; only a manual backfill (this script) re-attempts it.

Usage (run against the real DATABASE_URL, e.g. inside the hellofresh-agent
container or with the same env the app/agent use):

    python backfill_images.py

Safe to re-run: only touches products with `imageUrl IS NULL`, and only
overwrites a row once a re-download actually succeeds.
"""

import logging
import time

import psycopg2

from agent import (
    DATABASE_URL,
    REQUEST_DELAY_SECONDS,
    download_image,
    fetch_recipe,
    fetch_sitemap_entries,
    recipe_id_from_url,
    save_image,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("hellofresh-backfill-images")


def missing_image_recipe_ids(conn):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT "externalId" FROM products
               WHERE "externalSource" = 'HELLOFRESH' AND "imageUrl" IS NULL"""
        )
        return {row[0] for row in cur.fetchall()}


def update_image(conn, recipe_id, image_url):
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE products SET "imageUrl" = %s
               WHERE "externalSource" = 'HELLOFRESH' AND "externalId" = %s AND "imageUrl" IS NULL""",
            (image_url, recipe_id),
        )


def run():
    with psycopg2.connect(DATABASE_URL) as conn:
        missing = missing_image_recipe_ids(conn)
        log.info("%d HelloFresh products currently have no image", len(missing))
        if not missing:
            return

        entries = fetch_sitemap_entries()
        url_by_recipe_id = {}
        for url, _lastmod in entries:
            recipe_id = recipe_id_from_url(url)
            if recipe_id in missing:
                url_by_recipe_id[recipe_id] = url

        log.info(
            "%d of %d missing-image recipes are still in the sitemap (rest were likely removed by HelloFresh)",
            len(url_by_recipe_id),
            len(missing),
        )

        fixed = 0
        still_missing = 0
        for recipe_id, url in url_by_recipe_id.items():
            try:
                recipe = fetch_recipe(url)
                time.sleep(REQUEST_DELAY_SECONDS)
                if not recipe or not recipe.get("imagePath"):
                    log.warning("still no imagePath for %s (%s)", recipe_id, url)
                    still_missing += 1
                    continue

                content = download_image(recipe["imagePath"])
                ext = recipe["imagePath"].rsplit(".", 1)[-1]
                ext = f".{ext}" if len(ext) <= 5 else ".jpg"
                image_url = save_image("dishes", f"{recipe_id}{ext}", content)
                time.sleep(REQUEST_DELAY_SECONDS)

                update_image(conn, recipe_id, image_url)
                conn.commit()
                fixed += 1
                log.info("backfilled image for %s (%s)", recipe.get("name"), recipe_id)
            except Exception:  # noqa: BLE001 - one bad recipe must not stop the batch
                conn.rollback()
                still_missing += 1
                log.exception("failed to backfill image for %s (%s)", recipe_id, url)

        log.info(
            "backfill complete — fixed %d, still missing %d (%d recipes no longer on the site)",
            fixed,
            still_missing,
            len(missing) - len(url_by_recipe_id),
        )


if __name__ == "__main__":
    run()

# Recipe-site scrapers (Arla, Coop, REMA 1000, MENY, Hjerteforeningen, TV 2)

Same setup as `scripts/valdemarsro-import`: Playwright, one listing at a time,
each recipe scraped as soon as it is found, Temp checkpoints every 20 recipes,
images saved live. Re-running resumes from the latest checkpoint.

`recipe_sites_common.py` is the shared engine; each site file only says where
the listings are. Recipes are read from the page's schema.org Recipe JSON-LD
(Hjerteforeningen: from the page itself).

| Script | Discovery |
| --- | --- |
| `arla.py` | Inspiration pages (incl. madpakker-til-born) first, then `/opskrifter/?page=N` |
| `coop.py` | Theme pages, then "Alle opskrifter" A-Å with numbered pages |
| `rema1000.py` | Theme pages (incl. mad-for-born), then `/opskrifter/alle/N` |
| `meny.py` | Every filter (Børnekok, Madpakke, Dessert, ...) expanded with "Hent flere opskrifter" |
| `hjerteforeningen.py` | The overview page, which links every recipe |
| `tv2.py` | "Vis flere" clicked until it disappears |

All sites also follow related-recipe links on each recipe page.

Extra columns per recipe:
- **Meal Type**: Frokost / Aftensmad / Fin middag / Mellemmåltid / Dessert —
  from the site's own categories, keywords and theme/filter names first,
  otherwise from words in the recipe name. Blank when nothing fits.
- **Child Friendly**: "Børnevenlig" when the name, description, keywords,
  categories or the listing it was found on mention børn/barn/unger.
- **Site Nutrition ...**: nutrition as the site states it (Arla per 100 g,
  Hjerteforeningen per person). The matcher uses a per-person value as the
  final calories; otherwise calories are calculated from the ingredients.

Output: `Productdatabase/Opskrifter/<Site>/` (Images/, Temp/, `<site>.xlsx`,
`<site>_ingredients.xlsx`, `<site>_nutrition.xlsx`).

```
cd "C:\Users\Peter\Desktop\Hello Cal\scripts\recipe-sites-import"
C:\Users\Peter\.venv\Scripts\python.exe arla.py
C:\Users\Peter\.venv\Scripts\python.exe recipe_sites_match.py arla
```

Replace `arla` with `coop`, `rema1000`, `meny`, `hjerteforeningen` or `tv2`.
The matcher reuses `scripts/valdemarsro-import/valdemarsro_match.py`; unmatched
ingredients go to the Review sheet and can be fixed in
`<site>_manual_matches.xlsx`.

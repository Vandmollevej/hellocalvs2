# Valdemarsro recipe scraper

Scrapes every recipe on valdemarsro.dk (name, image, servings, times,
ingredients with quantity/unit, instructions) with Playwright, one category
at a time. Nutrition on the site is Premium-only and is NOT scraped;
`valdemarsro_match.py` calculates calories by matching the ingredients
against Frida (`scripts/frida-import/data`) and the store databases in
`Productdatabase`. Unmatched ingredients go to the "Review" sheet and can be
fixed in `valdemarsro_manual_matches.xlsx`.

Working copy and output live in `Productdatabase/Valdemarsro` (Images/, Temp/,
valdemarsro.xlsx, valdemarsro_ingredients.xlsx, valdemarsro_nutrition.xlsx).
Copy both scripts there before running:

```
cd "C:\Users\Peter\Desktop\Hello Cal\Productdatabase\Valdemarsro"
C:\Users\Peter\.venv\Scripts\python.exe valdemarsro.py
C:\Users\Peter\.venv\Scripts\python.exe valdemarsro_match.py
```

Re-running resumes from the latest Temp checkpoint.

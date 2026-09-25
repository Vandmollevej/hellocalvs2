"""Calculate calories for the scraped Valdemarsro recipes.

Valdemarsro only shows nutrition to Premium members, so it is not scraped.
Instead every ingredient line is converted to grams and matched against:
  1. Frida (DTU's Danish food database) - generic raw ingredients.
  2. The Danish store product databases in Productdatabase (Nemlig, REMA 1000,
     Bilka, SPAR, DRK, Aarstiderne) - processed items like canned tomatoes.

Nothing is guessed: a line that cannot be converted to grams or matched
with enough confidence goes to the "Review" sheet, and its recipe gets
Match Status "needs review" with no totals. Fill in
valdemarsro_manual_matches.xlsx (created on first run) and run again.

Run after valdemarsro.py.
"""

from __future__ import annotations

import re
import sys
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook

from valdemarsro import (
    INGREDIENT_FILE,
    RECIPE_FILE,
    ROOT_DIR,
    append_sheet,
    clean_text,
    read_sheet,
    save_workbook,
)

# ============================================================
# Fixed paths
# ============================================================
HELLO_CAL_DIR = Path(r"C:\Users\Peter\Desktop\Hello Cal")
FRIDA_FILE = HELLO_CAL_DIR / "scripts" / "frida-import" / "data" / "Frida_FCDB_6.1_full.xlsx"
PRODUCT_DATABASE_DIR = HELLO_CAL_DIR / "Productdatabase"
STORE_FOLDERS = ["Nemlig", "REMA1000", "Bilka", "SPAR", "DRK", "Aarstiderne"]
NUTRITION_FILE = ROOT_DIR / "valdemarsro_nutrition.xlsx"
MANUAL_MATCH_FILE = ROOT_DIR / "valdemarsro_manual_matches.xlsx"

# Frida parameter IDs (same as scripts/frida-import/agent.py).
PARAM_KCAL = 356
PARAM_PROTEIN = 218
PARAM_CARBS = 170
PARAM_FAT = 141

# Minimum similarity for an automatic match. Frida is preferred for plain
# ingredients; a store product must score higher to win over Frida.
MIN_FRIDA_SCORE = 0.72
MIN_STORE_SCORE = 0.8

MANUAL_HEADERS = ["Ingredient Name", "Reference Name", "Grams Per Piece", "Ignore"]

# ============================================================
# Unit -> grams
# ============================================================
UNIT_GRAMS = {"g": 1.0, "kg": 1000.0, "mg": 0.001, "pinch": 0.5, "clove": 5.0, "handful": 20.0,
              "stalk": 40.0, "slice": 25.0, "leaf": 1.0, "sprig": 1.0, "bunch": 40.0, "can": 400.0}
UNIT_ML = {"ml": 1.0, "cl": 10.0, "dl": 100.0, "l": 1000.0, "tbsp": 15.0, "tsp": 5.0, "splash": 10.0}

# Grams per ml for common ingredients measured by volume (default 1.0).
DENSITY = {
    "olie": 0.92, "olivenolie": 0.92, "rapsolie": 0.92, "smør": 0.95, "mel": 0.55, "hvedemel": 0.55,
    "sukker": 0.85, "flormelis": 0.5, "rørsukker": 0.85, "ris": 0.85, "havregryn": 0.4, "honning": 1.4,
    "sirup": 1.35, "kakao": 0.45, "salt": 1.2, "bagepulver": 0.9, "revet ost": 0.4, "parmesan": 0.4,
    "hytteost": 1.0, "fløde": 1.0, "mælk": 1.03, "yoghurt": 1.03, "creme fraiche": 1.0, "bulgur": 0.8,
    "linser": 0.8, "quinoa": 0.8, "nødder": 0.55, "mandler": 0.55, "rosiner": 0.65, "kokosmel": 0.35,
    # Dried spices and herbs are light.
    "stødt": 0.5, "tørret": 0.3, "tørrede": 0.3, "garam masala": 0.5, "karry": 0.5, "paprika": 0.5,
    "spidskommen": 0.5, "chiliflager": 0.4, "kanel": 0.5, "oregano": 0.3, "timian": 0.3, "fennikelfrø": 0.5,
}

# Typical weight of one piece (grams) when a line has no unit ("2 løg").
PIECE_GRAMS = {
    "løg": 100, "rødløg": 100, "skalotteløg": 30, "forårsløg": 15, "hvidløg": 5, "gulerod": 80,
    "gulerødder": 80, "kartoffel": 100, "kartofler": 100, "søde kartofler": 250, "sød kartoffel": 250,
    "æg": 55, "æggeblomme": 18, "æggehvide": 35, "citron": 100, "lime": 60, "appelsin": 180,
    "æble": 150, "pære": 170, "banan": 120, "tomat": 100, "tomater": 100, "cherrytomater": 15,
    "peberfrugt": 150, "rød peberfrugt": 150, "porre": 200, "porrer": 200, "squash": 300, "aubergine": 300,
    "agurk": 350, "avocado": 150, "chili": 10, "rød chili": 10, "persillerod": 100, "pastinak": 150,
    "selleri": 600, "knoldselleri": 600, "blomkål": 600, "broccoli": 400, "hvidkål": 1000, "spidskål": 700,
    "rødbede": 150, "rødbeder": 150, "fennikel": 250, "champignon": 20, "kyllingebryst": 150,
    "kyllingebrystfilet": 150, "kyllingelår": 200, "hel kylling": 1400, "kylling": 1400, "bøf": 180,
    "pitabrød": 70, "tortilla": 60, "tortillas": 60, "burgerbolle": 60, "mozzarella": 125, "burrata": 125,
    "vanillestang": 3, "laurbærblad": 0.2, "ingefær": 20,
}

# Oil for deep-frying is mostly left in the pan, so it is not counted.
FRYING_OIL_RE = re.compile(r"fritureolie|til friture|til frituren|friturestegning", re.IGNORECASE)

# Seasonings "to taste" without a quantity count as 0 g.
TO_TASTE = ("salt", "peber", "friskkværnet peber", "salt og peber", "vand", "is", "krydderurter til pynt")


# Words in a reference name that mean a processed form ("Løg, ristede").
PROCESSED_WORDS = {
    "ristede", "stegt", "stegte", "dybfrost", "tørrede", "tørret", "pulver", "konserves", "koncentreret",
    "frø", "terning", "fastfood", "takeaway", "soltørret", "is", "instant", "marineret", "røget", "paneret",
}

# Recipe wording -> the name used in the reference data (after normalize()).
LIQUID_STOCK = "bouillon hønsekød spiseklar"
ALIASES = {
    "mælk": "letmælk", "rødløg": "løg", "gule løg": "løg", "zittauerløg": "løg",
    "hakkede tomater": "tomat flået konserves", "hakkede tomater på dåse": "tomat flået konserves",
    "flåede tomater": "tomat flået konserves", "tomater på dåse": "tomat flået konserves",
    "blommetomater": "tomat", "cherrytomater": "tomat", "tomater": "tomat", "bredbladet persille": "persille",
    "kruspersille": "persille", "koriander": "koriander blade friske", "limefrugt": "lime", "citroner": "citron",
    "gulerødder": "gulerod", "kartofler": "kartoffel", "æg": "æg høne skrabehøns rå", "æggeblomme": "æg høne blomme rå", "æggeblommer": "æg høne blomme rå",
    "æggehvide": "æg høne æggehvide rå", "æggehvider": "æg høne æggehvide rå", "hakket kylling": "kyllingekød hakket",
    "hakket kyllingekød": "kyllingekød hakket", "piskefløde": "fløde 38",
    "madlavningsfløde": "fløde 18", "macaroni": "pasta", "makaroni": "pasta", "spaghetti": "pasta",
    "penne": "pasta", "fusilli": "pasta", "tagliatelle": "pasta", "lasagneplader": "pasta", "pastaskruer": "pasta", "cremefraiche": "creme fraiche 18", "creme fraiche": "creme fraiche 18",
}

DESCRIPTOR_WORDS = {
    "øko", "på", "dåse", "mediumstærk", "stærk", "mild", "friskpresset", "friskrevet", "smuldret",
    "frisk", "friske", "friskt", "finthakket", "hakkede", "revet", "revne", "fintrevet", "grofthakket",
    "stor", "store", "lille", "små", "mellemstor", "mellemstore", "økologisk", "økologiske", "god", "gode",
    "evt", "evt.", "gerne", "kogte", "kogt", "stegt", "stegte", "tørret", "tørrede", "skåret", "skiver", "tern",
    "i", "til", "af", "hel", "hele", "halve", "fin", "fint", "groft", "stødt", "knust", "knuste", "pillede",
}


# ============================================================
# Reference foods
# ============================================================
@dataclass
class Food:
    name: str
    source: str
    kcal: float
    protein: float
    carbs: float
    fat: float
    key: str = ""
    full: str = ""


def normalize(text: str) -> str:
    text = clean_text(text).lower()
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^a-zæøå0-9 ]+", " ", text)
    words = [w for w in text.split() if w not in DESCRIPTOR_WORDS]
    return " ".join(words)


def to_float(value: Any) -> float | None:
    text = clean_text(value).replace(",", ".")
    try:
        return float(text) if text else None
    except ValueError:
        return None


def load_frida() -> list[Food]:
    print(f"Loading Frida: {FRIDA_FILE}")
    wb = load_workbook(FRIDA_FILE, read_only=True, data_only=True)
    names = {row[2]: row[0] for row in wb["Food"].iter_rows(min_row=2, values_only=True) if row[2] is not None}
    wanted = {PARAM_KCAL, PARAM_PROTEIN, PARAM_CARBS, PARAM_FAT}
    values: dict[Any, dict[int, float]] = {}
    for row in wb["Data_Normalised"].iter_rows(min_row=2, values_only=True):
        if row[3] in wanted and isinstance(row[7], (int, float)):
            values.setdefault(row[0], {})[row[3]] = float(row[7])
    wb.close()
    foods = []
    for food_id, params in values.items():
        if wanted.issubset(params) and names.get(food_id):
            name = clean_text(names[food_id])
            # Frida names are "Løg, rå" - the first segment is what a recipe calls it.
            foods.append(Food(name, "Frida", params[PARAM_KCAL], params[PARAM_PROTEIN], params[PARAM_CARBS],
                              params[PARAM_FAT], normalize(name.split(",")[0]), normalize(name)))
    print(f"  {len(foods)} Frida foods")
    return foods


def load_store_products() -> list[Food]:
    foods = []
    for folder in STORE_FOLDERS:
        matches = list((PRODUCT_DATABASE_DIR / folder).glob("*_product_information.xlsx"))
        if not matches:
            continue
        wb = load_workbook(matches[0], read_only=True, data_only=True)
        for row in read_sheet(wb, wb.sheetnames[0]):
            kcal = to_float(row.get("Energy kcal per 100 g"))
            protein = to_float(row.get("Protein per 100 g"))
            carbs = to_float(row.get("Carbohydrate per 100 g"))
            fat = to_float(row.get("Fat per 100 g"))
            title = clean_text(row.get("HelloCal_Title"))
            if not title or None in (kcal, protein, carbs, fat):
                continue
            # "Hakkede tomater, 400g (REMA 1000)" -> "hakkede tomater"
            plain = re.sub(r",\s*[\d.,]+\s*(g|kg|ml|cl|l|stk)\b.*$", "", title, flags=re.IGNORECASE)
            foods.append(Food(title, folder, kcal, protein, carbs, fat, normalize(plain), normalize(plain)))
        wb.close()
    print(f"  {len(foods)} store products with nutrition")
    return foods


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ratio = SequenceMatcher(None, a, b).ratio()
    tokens_a, tokens_b = set(a.split()), set(b.split())
    overlap = len(tokens_a & tokens_b) / max(len(tokens_a), len(tokens_b))
    return max(ratio, overlap)


class Matcher:
    def __init__(self, frida: list[Food], store: list[Food]) -> None:
        self.frida = frida
        self.store = store
        self.by_name = {food.name.lower(): food for food in frida + store}
        self.cache: dict[str, tuple[Food | None, float]] = {}
        # Only foods sharing a word stem with the query are compared.
        self.index: dict[int, dict[str, list[Food]]] = {}
        for foods in (frida, store):
            index: dict[str, list[Food]] = {}
            for food in foods:
                for stem in {word[:5] for word in food.full.split()}:
                    index.setdefault(stem, []).append(food)
            self.index[id(foods)] = index

    def best(self, query: str, foods: list[Food], raw_words: set[str]) -> tuple[Food | None, float]:
        index = self.index[id(foods)]
        candidates = {id(f): f for stem in {w[:5] for w in query.split()} for f in index.get(stem, [])}
        best_food, best_score = None, 0.0
        query_words = set(query.split()) | raw_words
        for food in candidates.values():
            score = max(similarity(query, food.key), similarity(query, food.full))
            # Several foods share a key ("Løg, rå" / "Løg, ristede"): prefer the
            # raw, unprocessed one unless the recipe asks for the processed form.
            name = food.full
            if re.search(r"\b(rå|råt|rå vægt|spiseklar)\b", name):
                score += 0.03
            score -= 0.15 * len((set(re.findall(r"[a-zæøå]+", food.name.lower())) & PROCESSED_WORDS) - query_words)
            score -= 0.002 * len(name)
            if score > best_score:
                best_food, best_score = food, score
        return best_food, min(best_score, 1.0)

    def match(self, ingredient: str, volume: bool = False) -> tuple[Food | None, float]:
        query = normalize(ingredient)
        query = ALIASES.get(query, query)
        if volume and re.search(r"(bouillon|fond)$", query):
            query = LIQUID_STOCK
        cache_key = f"{query}|{volume}|{clean_text(ingredient).lower()}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        result = self._match(query, set(re.findall(r"[a-zæøå]+", ingredient.lower())))
        self.cache[cache_key] = result
        return result

    def _match(self, query: str, raw_words: set[str]) -> tuple[Food | None, float]:
        frida, frida_score = self.best(query, self.frida, raw_words)
        store, store_score = self.best(query, self.store, raw_words)
        if frida and frida_score >= MIN_FRIDA_SCORE and frida_score >= store_score - 0.05:
            result = (frida, frida_score)
        elif store and store_score >= MIN_STORE_SCORE:
            result = (store, store_score)
        elif frida and frida_score >= MIN_FRIDA_SCORE:
            result = (frida, frida_score)
        else:
            result = (None, max(frida_score, store_score))
        return result


# ============================================================
# Manual matches
# ============================================================
def load_manual_matches() -> dict[str, dict[str, Any]]:
    if not MANUAL_MATCH_FILE.exists():
        wb = Workbook()
        append_sheet(wb, "Manual Matches", MANUAL_HEADERS, [], first=True)
        save_workbook(wb, MANUAL_MATCH_FILE)
        return {}
    wb = load_workbook(MANUAL_MATCH_FILE, read_only=True, data_only=True)
    rows = read_sheet(wb, wb.sheetnames[0])
    wb.close()
    return {normalize(row.get("Ingredient Name")): row for row in rows if clean_text(row.get("Ingredient Name"))}


def keyword_value(table: dict[str, float], name: str, raw: bool = False) -> float | None:
    normalized = clean_text(name).lower() if raw else normalize(name)
    if normalized in table:
        return table[normalized]
    for key in sorted(table, key=len, reverse=True):
        if re.search(rf"\b{re.escape(key)}\b", normalized):
            return table[key]
    return None


def to_grams(line: dict[str, Any], manual: dict[str, Any] | None) -> tuple[float | None, str]:
    quantity = to_float(line.get("Quantity"))
    unit = clean_text(line.get("Unit"))
    name = clean_text(line.get("Ingredient Name"))
    if FRYING_OIL_RE.search(clean_text(line.get("Raw Text"))):
        return 0.0, "deep-frying oil, not eaten (0 g)"
    if quantity is None:
        if normalize(name) in TO_TASTE or name.lower().startswith(("salt", "peber")):
            return 0.0, "to taste (0 g)"
        return None, "no quantity"
    if unit in UNIT_GRAMS:
        return quantity * UNIT_GRAMS[unit], f"{unit} x {UNIT_GRAMS[unit]:g} g"
    if unit in UNIT_ML:
        density = keyword_value(DENSITY, name, raw=True) or 1.0
        return quantity * UNIT_ML[unit] * density, f"{unit} = {UNIT_ML[unit]:g} ml x {density:g} g/ml"
    if unit in {"", "pcs"}:
        manual_piece = to_float(manual.get("Grams Per Piece")) if manual else None
        piece = manual_piece or keyword_value(PIECE_GRAMS, name)
        if piece:
            return quantity * piece, f"piece = {piece:g} g"
        return None, "unknown piece weight"
    return None, f"unknown unit '{unit}'"


# ============================================================
# Main
# ============================================================
def main() -> None:
    if not RECIPE_FILE.exists() or not INGREDIENT_FILE.exists():
        print(f"Run valdemarsro.py first - missing {RECIPE_FILE.name} / {INGREDIENT_FILE.name}")
        sys.exit(1)

    wb = load_workbook(RECIPE_FILE, read_only=True, data_only=True)
    recipes = read_sheet(wb, "Recipes")
    wb.close()
    wb = load_workbook(INGREDIENT_FILE, read_only=True, data_only=True)
    lines = read_sheet(wb, "Ingredients")
    wb.close()
    print(f"{len(recipes)} recipes, {len(lines)} ingredient lines")

    matcher = Matcher(load_frida(), load_store_products())
    manual_matches = load_manual_matches()

    match_rows: list[dict[str, Any]] = []
    review: dict[str, dict[str, Any]] = {}
    totals: dict[str, dict[str, float]] = {}

    for line in lines:
        title = clean_text(line.get("HelloCal_Title"))
        name = clean_text(line.get("Ingredient Name"))
        manual = manual_matches.get(normalize(name))
        total = totals.setdefault(title, {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "grams": 0.0,
                                          "matched": 0, "review": 0})
        row = {**line, "Grams": "", "Grams Basis": "", "Match Source": "", "Matched Name": "", "Score": "",
               "Energy kcal": "", "Status": ""}

        if manual and clean_text(manual.get("Ignore")):
            row["Status"] = "ignored (manual)"
            total["matched"] += 1
            match_rows.append(row)
            continue

        grams, basis = to_grams(line, manual)
        food, score = (None, 0.0)
        if manual and clean_text(manual.get("Reference Name")):
            food = matcher.by_name.get(clean_text(manual["Reference Name"]).lower())
            score = 1.0 if food else 0.0
        elif grams:
            food, score = matcher.match(name, volume=clean_text(line.get("Unit")) in UNIT_ML)

        row.update({"Grams Basis": basis, "Score": round(score, 2)})
        if grams is not None:
            row["Grams"] = round(grams, 1)

        if grams == 0:
            row["Status"] = "ok (0 g)"
            total["matched"] += 1
        elif grams is not None and food:
            factor = grams / 100
            total["kcal"] += food.kcal * factor
            total["protein"] += food.protein * factor
            total["carbs"] += food.carbs * factor
            total["fat"] += food.fat * factor
            total["grams"] += grams
            total["matched"] += 1
            row.update({"Match Source": food.source, "Matched Name": food.name,
                        "Energy kcal": round(food.kcal * factor, 1), "Status": "ok"})
        else:
            reason = basis if grams is None else "no confident match"
            row["Status"] = f"review: {reason}"
            total["review"] += 1
            entry = review.setdefault(normalize(name) or name, {
                "Ingredient Name": name, "Reason": reason, "Best Guess": "", "Best Guess Score": "",
                "Example Line": clean_text(line.get("Raw Text")), "Recipe Count": 0,
            })
            entry["Recipe Count"] += 1
            if grams is not None:
                guess, guess_score = matcher.match(name, volume=clean_text(line.get("Unit")) in UNIT_ML)
                if guess:
                    entry["Best Guess"], entry["Best Guess Score"] = guess.name, round(guess_score, 2)
        match_rows.append(row)

    recipe_rows = []
    for recipe in recipes:
        title = clean_text(recipe.get("HelloCal_Title"))
        total = totals.get(title, {"kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "grams": 0, "matched": 0, "review": 0})
        servings = to_float(recipe.get("Servings")) or 0
        complete = total["review"] == 0 and total["matched"] > 0
        row = {
            "HelloCal_Title": title,
            "Servings": recipe.get("Servings"),
            "Servings Unit": recipe.get("Servings Unit"),
            "Matched Lines": total["matched"],
            "Review Lines": total["review"],
            "Match Status": "complete" if complete else "needs review",
            "Total Weight g": "", "Energy kcal total": "", "Energy kcal per serving": "",
            "Protein per serving": "", "Carbohydrate per serving": "", "Fat per serving": "",
            "Energy kcal per 100 g": "",
            "Source URL": recipe.get("Source URL"),
        }
        if complete:
            per = servings if servings > 0 else 1
            row.update({
                "Total Weight g": round(total["grams"]),
                "Energy kcal total": round(total["kcal"]),
                "Energy kcal per serving": round(total["kcal"] / per),
                "Protein per serving": round(total["protein"] / per, 1),
                "Carbohydrate per serving": round(total["carbs"] / per, 1),
                "Fat per serving": round(total["fat"] / per, 1),
                "Energy kcal per 100 g": round(total["kcal"] / total["grams"] * 100) if total["grams"] else "",
            })
        recipe_rows.append(row)

    review_rows = sorted(review.values(), key=lambda r: -r["Recipe Count"])
    wb = Workbook()
    append_sheet(wb, "Recipe Nutrition", list(recipe_rows[0].keys()) if recipe_rows else ["HelloCal_Title"], recipe_rows, first=True)
    append_sheet(wb, "Ingredient Matches", list(match_rows[0].keys()) if match_rows else ["HelloCal_Title"], match_rows)
    append_sheet(wb, "Review", ["Ingredient Name", "Reason", "Best Guess", "Best Guess Score", "Example Line", "Recipe Count"], review_rows)
    if save_workbook(wb, NUTRITION_FILE):
        complete = sum(1 for r in recipe_rows if r["Match Status"] == "complete")
        print(f"Saved: {NUTRITION_FILE}")
        print(f"Recipes with calories: {complete}/{len(recipe_rows)}")
        print(f"Ingredients to review: {len(review_rows)} (add them to {MANUAL_MATCH_FILE.name} and run again)")


if __name__ == "__main__":
    main()

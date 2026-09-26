"""Shared engine for the Danish recipe-site scrapers (Arla, Coop, REMA 1000,
MENY, Hjerteforeningen, TV 2).

Same structure and output as scripts/valdemarsro-import/valdemarsro.py:
one listing (category/page) at a time, every recipe scraped as soon as it is
found, Temp checkpoints every CHECKPOINT_EVERY recipes, images saved live.

Each site file only describes where the listings are and which links are
recipes. Recipes are read from the page's schema.org Recipe JSON-LD, with a
site-specific DOM fallback (Hjerteforeningen has no JSON-LD).

Every recipe is also classified:
  - "Child Friendly" = "Børnevenlig" when the recipe text, keywords,
    categories or the listing it was found on mention børn/barn/unger.
  - "Meal Type" = Frokost / Aftensmad / Fin middag / Mellemmåltid / Dessert
    (see classify_meal_type).
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.parse import urljoin, urlparse

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from playwright.sync_api import BrowserContext, Page, sync_playwright


# ============================================================
# Fixed Hello Cal scraper structure
# ============================================================
HELLO_CAL_DIR = Path(r"C:\Users\Peter\Desktop\Hello Cal")
RECIPE_ROOT_DIR = HELLO_CAL_DIR / "Productdatabase" / "Opskrifter"

CHECKPOINT_EVERY = 20
HEADLESS = True
PAGE_TIMEOUT_MS = 45_000
NAVIGATION_TIMEOUT_MS = 60_000
REQUEST_TIMEOUT_MS = 45_000
MAX_RETRIES = 3
MAX_PAGES_PER_LISTING = 400
MAX_LOAD_MORE_CLICKS = 600
POLITE_DELAY_MS = 600

# No recipe limit. The scrapers are intentionally configured to collect all discoverable recipes.

RECIPE_HEADERS = [
    "HelloCal_Title",
    "Recipe Name",
    "Meal Type",
    "Child Friendly",
    "Category",
    "Site Category",
    "Keywords",
    "Servings",
    "Servings Unit",
    "Total Time",
    "Work Time",
    "Ingredient Count",
    "Ingredients",
    "Instructions",
    "Description",
    "Site Nutrition Basis",
    "Site Energy kcal",
    "Site Protein g",
    "Site Carbohydrate g",
    "Site Fat g",
    "Image File",
    "Image URL",
    "Source URL",
    "Parse Status",
]

INGREDIENT_HEADERS = [
    "HelloCal_Title",
    "Line No",
    "Section",
    "Raw Text",
    "Quantity",
    "Unit",
    "Ingredient Name",
    "Note",
    "Source URL",
]


@dataclass
class SiteConfig:
    retailer: str                      # file prefix, e.g. "arla"
    display_name: str                  # e.g. "Arla"
    folder: str                        # folder under Productdatabase/Opskrifter
    host: str                          # e.g. "www.arla.dk"
    recipe_url_re: str                 # full-URL regex for recipe pages
    # (url, label) listings crawled first, e.g. theme pages that give context.
    category_roots: list[str] = field(default_factory=list)
    category_url_re: str = ""          # listing pages discovered on category_roots
    # Paged "all recipes" listings: functions page_no -> url, plus a label.
    paged_listings: list[tuple[str, Callable[[int], str]]] = field(default_factory=list)
    # Single listings, optionally expanded by clicking a "load more" button.
    plain_listings: list[str] = field(default_factory=list)
    load_more_label: str = ""          # regex for the "Vis flere" button
    # Filter listings read from the first plain listing: page -> [(label, url)].
    # Crawled like plain listings (with load more) before the plain listings.
    filter_listings: Callable[[Page], list[tuple[str, str]]] | None = None
    trailing_slash: bool = False
    dom_extract_js: str = ""           # fallback when there is no Recipe JSON-LD
    ignore_slugs: set[str] = field(default_factory=set)

    @property
    def root_dir(self) -> Path:
        return RECIPE_ROOT_DIR / self.folder

    @property
    def images_dir(self) -> Path:
        return self.root_dir / "Images"

    @property
    def temp_dir(self) -> Path:
        return self.root_dir / "Temp"

    @property
    def checkpoint_pattern(self) -> str:
        return f"{self.retailer}_checkpoint_*.xlsx"

    @property
    def recipe_file(self) -> Path:
        return self.root_dir / f"{self.retailer}.xlsx"

    @property
    def ingredient_file(self) -> Path:
        return self.root_dir / f"{self.retailer}_ingredients.xlsx"


@dataclass
class ScrapeState:
    recipes: list[dict[str, Any]] = field(default_factory=list)
    ingredients: list[dict[str, Any]] = field(default_factory=list)
    seen_listings: set[str] = field(default_factory=set)
    pending_recipes: list[str] = field(default_factory=list)
    processed_urls: set[str] = field(default_factory=set)
    skipped_urls: set[str] = field(default_factory=set)
    failed_urls: set[str] = field(default_factory=set)
    # Recipe URL -> listing labels it was found on (theme/category pages).
    contexts: dict[str, set[str]] = field(default_factory=dict)
    titles: set[str] = field(default_factory=set)
    by_url: dict[str, dict[str, Any]] = field(default_factory=dict)


# ============================================================
# General helpers
# ============================================================
def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def safe_filename(text: str) -> str:
    text = unicodedata.normalize("NFKD", clean_text(text))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^A-Za-z0-9._-]+", "-", text).strip("-._")
    return text[:120] or "recipe"


def dedupe_preserve(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def canonicalize_url(site: SiteConfig, url: str) -> str:
    parsed = urlparse(urljoin(f"https://{site.host}/", url))
    path = parsed.path
    if site.trailing_slash and not path.endswith("/"):
        path += "/"
    if not site.trailing_slash:
        path = path.rstrip("/") or "/"
    return f"https://{parsed.netloc}{path}"


def slug_of(url: str) -> str:
    parts = [p for p in urlparse(url).path.split("/") if p]
    return parts[-1] if parts else ""


def is_recipe_url(site: SiteConfig, url: str) -> bool:
    return bool(re.match(site.recipe_url_re, url)) and slug_of(url) not in site.ignore_slugs


# ============================================================
# Ingredient line parsing
# ============================================================
UNICODE_FRACTIONS = {"½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8"}

# Danish units as written on the sites -> canonical unit (same canonical
# units as valdemarsro.py, so the calorie matcher understands them).
UNIT_ALIASES = {
    "g": "g", "gr": "g", "gr.": "g", "gram": "g",
    "kg": "kg", "kilo": "kg", "kg.": "kg",
    "mg": "mg",
    "ml": "ml", "cl": "cl", "dl": "dl", "l": "l", "liter": "l", "milliliter": "ml", "centiliter": "cl",
    "deciliter": "dl", "dl.": "dl",
    "spsk": "tbsp", "spsk.": "tbsp", "spiseskefuld": "tbsp", "spiseskefulde": "tbsp", "spiseske": "tbsp",
    "spiseskeer": "tbsp",
    "tsk": "tsp", "tsk.": "tsp", "teskefuld": "tsp", "teskefulde": "tsp", "teske": "tsp", "teskeer": "tsp",
    "knsp": "pinch", "knsp.": "pinch", "knivspids": "pinch", "nip": "pinch",
    "stk": "pcs", "stk.": "pcs", "styk": "pcs", "styks": "pcs",
    "fed": "clove",
    "dåse": "can", "dåser": "can", "ds": "can", "ds.": "can",
    "pakke": "pack", "pakker": "pack", "pk": "pack", "pk.": "pack", "bakke": "pack", "bakker": "pack",
    "pose": "bag", "poser": "bag",
    "bundt": "bunch", "bundter": "bunch", "bdt": "bunch", "bdt.": "bunch",
    "håndfuld": "handful", "håndfulde": "handful", "håndfuldt": "handful",
    "stængel": "stalk", "stængler": "stalk",
    "skive": "slice", "skiver": "slice",
    "glas": "jar", "flaske": "bottle", "flasker": "bottle",
    "blad": "leaf", "blade": "leaf",
    "kvist": "sprig", "kviste": "sprig", "gren": "sprig", "grene": "sprig",
    "drys": "pinch", "sjat": "splash", "stænk": "splash",
}

QUANTITY_RE = re.compile(
    r"^(?:ca\.?\s*|cirka\s+|omkring\s+)?"
    r"(?P<q>\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)(?![\d/])"
    r"(?:\s*(?:-|–|til)\s*(?P<q2>\d+/\d+|\d+(?:[.,]\d+)?))?\s*",
    re.IGNORECASE,
)
WORD_ONE_RE = re.compile(r"^(en|et|én|ét)\s+(?=\S)", re.IGNORECASE)


def parse_number(text: str) -> float:
    total = 0.0
    for part in text.replace(",", ".").split():
        total += float(Fraction(part)) if "/" in part else float(part)
    return total


def parse_ingredient_line(raw: str) -> dict[str, Any]:
    """Split "2 spsk olivenolie, gerne ekstra jomfru" into quantity, unit,
    ingredient name and note. A range ("2-3 løg") uses its midpoint."""
    text = clean_text(raw)
    for symbol, replacement in UNICODE_FRACTIONS.items():
        text = re.sub(rf"(\d)\s*{symbol}", rf"\1 {replacement}", text)
        text = text.replace(symbol, replacement)
    # REMA writes "0  salt" for to-taste lines.
    text = re.sub(r"^0\s+(?=\D)", "", text)

    quantity: float | str = ""
    match = QUANTITY_RE.match(text)
    if match:
        low = parse_number(match.group("q"))
        high = parse_number(match.group("q2")) if match.group("q2") else low
        quantity = round((low + high) / 2, 3)
        text = text[match.end():]
    else:
        word = WORD_ONE_RE.match(text)
        if word and text[word.end():].split(" ")[0].lower() in UNIT_ALIASES:
            quantity = 1.0
            text = text[word.end():]

    unit = ""
    first, _, rest = text.partition(" ")
    if first.lower() in UNIT_ALIASES and (quantity != "" or first.lower() in {"knsp", "knivspids", "nip", "drys", "sjat"}):
        unit = UNIT_ALIASES[first.lower()]
        text = rest

    name, _, note = text.partition(",")
    return {
        "Quantity": quantity,
        "Unit": unit,
        "Ingredient Name": clean_text(name),
        "Note": clean_text(note),
    }


# ============================================================
# Classification: child friendly + meal type
# ============================================================
CHILD_TEXT_RE = re.compile(r"\b(børn\w*|barn\w*|unger\w*|børne\w*)", re.IGNORECASE)
CHILD_SLUG_RE = re.compile(r"(^|-)(born|boern|borne|boerne|barn|boernevenlig|bornevenlig|unger)(-|$)", re.IGNORECASE)

MEAL_TYPES = ["Dessert", "Fin middag", "Mellemmåltid", "Frokost", "Aftensmad"]
# The site's own labels are checked with main meals before snacks, so a
# recipe tagged both "Aftensmad" and "Tilbehør" counts as Aftensmad.
LABEL_ORDER = ["Dessert", "Fin middag", "Aftensmad", "Frokost", "Mellemmåltid"]

# Site categories/keywords/listing labels -> meal type. Checked first, in
# MEAL_TYPES order, because they are the site's own labelling.
CATEGORY_WORDS = {
    "Dessert": r"dessert\w*|is\b|isdessert\w*|efterret\w*|sødt|kold\s?skål",
    "Fin middag": r"fin middag|festmad|fest|højtid\w*|gæster|middagsselskab|jul\w*|nytår\w*|påske\w*|forret\w*|nytaar|paaske|3-retters|weekend",
    "Mellemmåltid": r"mellemmåltid\w*|snack\w*|bagværk|kage\w*|boller|brød|bagning|smoothie\w*|drikkevarer|kolde drikke|varme drikke|drinks|morgenmad|brunch\w*|tilbehør|dip\w*",
    "Frokost": r"frokost\w*|madpakke\w*|sandwich\w*|smørrebrød|picnic|mad på farten|mad-pa-farten",
    "Aftensmad": r"aftensmad|hovedret\w*|middag|hverdagsmad|nem hverdagsmad|gryderet\w*|one pot",
}

# Recipe-name words -> meal type (used when the site gives no usable label).
NAME_WORDS = {
    "Dessert": r"dessert|is\b|parfait|sorbet|mousse|tiramisu|panna cotta|cheesecake|trifle|koldskål|risalamande|"
               r"crumble|fromage|pavlova|marengs|brownie\w*|trøffel|chokoladekage|lagkage|citronfromage|"
               r"rødgrød|frugtsalat|pudding|softice|frozen yoghurt|creme brûlée|crème brûlée",
    "Fin middag": r"mørbrad|oksefilet|kalvefilet|lammekrone|lammeculotte|andebryst|\band\b|helstegt|ribeye|"
                  r"tournedos|hummer|kammusling|rådyr|hjort|dådyr|vildt|kalvetyksteg|culotte|beef wellington|"
                  r"flæskesteg|kalkun|carpaccio|tatar",
    "Mellemmåltid": r"bolle\w*|brød|muffin\w*|cookie\w*|småkage\w*|kage\w*|smoothie\w*|snack\w*|bar\b|barer|"
                    r"knækbrød|energikugle\w*|kugler|dip\b|hummus|grød|granola|mysli|overnight oats|pandekage\w*|"
                    r"scones|kanelsnegl\w*|snegl\w*|chips|popcorn|juice|saft|lemonade|te\b|kakao",
    "Frokost": r"sandwich\w*|wrap\w*|smørrebrød|tærte|salat|frikadeller|madpakke|pita\w*|toast|panini|"
               r"omelet|æggekage|bagel\w*|tortilla\w*|quiche|frittata|bowl\b|poke|pokebowl|tunmousse|hønsesalat",
    "Aftensmad": r"gryde\w*|pasta|lasagne|suppe|wok|karry|curry|risotto|chili|kylling|laks|torsk|fisk|"
                 r"kødboller|bøf\w*|burger\w*|pizza|taco\w*|gullasch|gullash|dhal|dahl|nudler|ris\b|"
                 r"frikassé|stuvning|farsbrød|medister|kotelet\w*|lasagnette|gratin|ovnret|fad\b",
}


def is_child_friendly(texts: Iterable[str], slugs: Iterable[str]) -> bool:
    if any(CHILD_TEXT_RE.search(t or "") for t in texts):
        return True
    return any(CHILD_SLUG_RE.search(s or "") for s in slugs)


def classify_meal_type(labels: Iterable[str], name: str) -> str:
    label_text = " | ".join(clean_text(l).lower().replace("-", " ") for l in labels if l)
    for meal in LABEL_ORDER:
        if label_text and re.search(rf"\b(?:{CATEGORY_WORDS[meal]})", label_text):
            return meal
    lowered = clean_text(name).lower()
    for meal in MEAL_TYPES:
        if re.search(rf"\b(?:{NAME_WORDS[meal]})", lowered):
            return meal
    return ""


# ============================================================
# Workbook helpers
# ============================================================
def style_header(ws) -> None:
    for cell in ws[1]:
        cell.font = Font(bold=True)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions


def append_sheet(wb: Workbook, title: str, headers: list[str], rows: list[dict[str, Any]], first: bool = False) -> None:
    ws = wb.active if first else wb.create_sheet(title)
    ws.title = title
    ws.append(headers)
    for row in rows:
        ws.append([row.get(header, "") for header in headers])
    style_header(ws)


def save_workbook(wb: Workbook, path: Path) -> bool:
    try:
        wb.save(path)
        return True
    except PermissionError:
        print(f"Could not save {path.name} - file is open elsewhere. Skipped.")
        return False


def read_sheet(wb, name: str) -> list[dict[str, Any]]:
    if name not in wb.sheetnames:
        return []
    rows = wb[name].iter_rows(values_only=True)
    headers = [clean_text(x) for x in next(rows, [])]
    result = []
    for values in rows:
        row = {headers[i]: values[i] if i < len(values) and values[i] is not None else "" for i in range(len(headers))}
        if any(clean_text(v) for v in row.values()):
            result.append(row)
    return result


def save_final_files(site: SiteConfig, state: ScrapeState) -> None:
    wb = Workbook()
    append_sheet(wb, "Recipes", RECIPE_HEADERS, state.recipes, first=True)
    save_workbook(wb, site.recipe_file)
    wb = Workbook()
    append_sheet(wb, "Ingredients", INGREDIENT_HEADERS, state.ingredients, first=True)
    save_workbook(wb, site.ingredient_file)


def save_temp(site: SiteConfig, state: ScrapeState) -> None:
    wb = Workbook()
    append_sheet(wb, "Recipes", RECIPE_HEADERS, state.recipes, first=True)
    append_sheet(wb, "Ingredients", INGREDIENT_HEADERS, state.ingredients)
    ws_state = wb.create_sheet("State")
    ws_state.append(["Type", "URL", "Label"])
    for url in state.pending_recipes:
        ws_state.append(["pending", url, ""])
    for kind, urls in (
        ("listing_seen", state.seen_listings),
        ("processed", state.processed_urls),
        ("skipped", state.skipped_urls),
        ("failed", state.failed_urls),
    ):
        for url in sorted(urls):
            ws_state.append([kind, url, ""])
    for url, labels in state.contexts.items():
        for label in sorted(labels):
            ws_state.append(["context", url, label])
    style_header(ws_state)

    checkpoint_file = site.temp_dir / f"{site.retailer}_checkpoint_{len(state.recipes):07d}.xlsx"
    if save_workbook(wb, checkpoint_file):
        print(f"Checkpoint saved: {checkpoint_file} ({len(state.recipes)} recipes)")


def load_temp(site: SiteConfig) -> ScrapeState:
    state = ScrapeState()
    checkpoints = sorted(site.temp_dir.glob(site.checkpoint_pattern))
    if not checkpoints:
        return state
    try:
        wb = load_workbook(checkpoints[-1], read_only=True, data_only=True)
        state.recipes = read_sheet(wb, "Recipes")
        state.ingredients = read_sheet(wb, "Ingredients")
        for row in read_sheet(wb, "State"):
            kind, url, label = clean_text(row.get("Type")).lower(), clean_text(row.get("URL")), clean_text(row.get("Label"))
            if not url:
                continue
            if kind == "pending":
                state.pending_recipes.append(url)
            elif kind == "listing_seen":
                state.seen_listings.add(url)
            elif kind == "processed":
                state.processed_urls.add(url)
            elif kind == "skipped":
                state.skipped_urls.add(url)
            elif kind == "failed":
                state.failed_urls.add(url)
            elif kind == "context" and label:
                state.contexts.setdefault(url, set()).add(label)
        wb.close()
        state.titles = {clean_text(r.get("HelloCal_Title")) for r in state.recipes}
        state.by_url = {clean_text(r.get("Source URL")): r for r in state.recipes}
        state.pending_recipes = dedupe_preserve(u for u in state.pending_recipes if u not in state.processed_urls)
        print(
            f"Checkpoint loaded: {len(state.recipes)} recipes, {len(state.seen_listings)} listing pages done, "
            f"{len(state.pending_recipes)} recipe links pending"
        )
        return state
    except Exception as exc:
        print(f"Could not load checkpoint. Starting fresh. Reason: {exc}")
        return ScrapeState()


# ============================================================
# Browser helpers
# ============================================================
def create_context(browser) -> BrowserContext:
    context = browser.new_context(
        locale="da-DK",
        timezone_id="Europe/Copenhagen",
        viewport={"width": 1440, "height": 1100},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/151.0.0.0 Safari/537.36"
        ),
    )
    context.set_default_timeout(PAGE_TIMEOUT_MS)
    context.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
    return context


COOKIE_LABELS = [
    "Kun nødvendige", "Kun nødvendige cookies", "Tillad kun nødvendige", "Afvis alle", "Afvis", "Fortsæt uden at acceptere",
    "Nej tak", "Decline", "Reject all",
]


def handle_cookies(page: Page) -> None:
    # Decline non-essential cookies when the banner offers it.
    for label in COOKIE_LABELS:
        try:
            locator = page.get_by_role("button", name=re.compile(rf"^\s*{re.escape(label)}\s*$", re.IGNORECASE))
            if locator.count() > 0 and locator.first.is_visible():
                locator.first.click(timeout=2_000)
                page.wait_for_timeout(500)
                return
        except Exception:
            pass


def goto_with_retry(page: Page, url: str) -> bool:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
            page.wait_for_timeout(POLITE_DELAY_MS)
            handle_cookies(page)
            return True
        except Exception as exc:
            print(f"Navigation attempt {attempt}/{MAX_RETRIES} failed: {url} - {exc}")
            if attempt < MAX_RETRIES:
                page.wait_for_timeout(1_500 * attempt)
    return False


def page_links(site: SiteConfig, page: Page) -> list[str]:
    try:
        links = page.eval_on_selector_all("a[href]", "els => els.map(a => a.href).filter(Boolean)")
    except Exception:
        return []
    return dedupe_preserve(canonicalize_url(site, url) for url in links if site.host in url)


def recipe_links(site: SiteConfig, page: Page) -> list[str]:
    return [url for url in page_links(site, page) if is_recipe_url(site, url)]


def next_page_url(site: SiteConfig, page: Page) -> str:
    try:
        href = page.eval_on_selector('link[rel="next"]', "el => el.href")
        return href or ""
    except Exception:
        return ""


def download_image(site: SiteConfig, context: BrowserContext, url: str, key: str) -> str:
    if not url:
        return ""
    try:
        response = context.request.get(url, timeout=REQUEST_TIMEOUT_MS)
        if not response.ok:
            print(f"Image download failed ({response.status}): {url}")
            return ""
        content_type = (response.headers.get("content-type") or "").lower()
        extension = Path(urlparse(url).path).suffix.lower()
        if "webp" in content_type:
            extension = ".webp"
        elif "png" in content_type:
            extension = ".png"
        elif extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            extension = ".jpg"
        filename = f"{safe_filename(key)}{extension}"
        path = site.images_dir / filename
        if not path.exists():
            path.write_bytes(response.body())
        return filename
    except Exception as exc:
        print(f"Image download failed: {url} - {exc}")
        return ""


# ============================================================
# Recipe extraction
# ============================================================
# Collects every schema.org Recipe in the page's JSON-LD (handles arrays,
# @graph and sites that write "type" instead of "@type").
JSON_LD_JS = """
() => {
  const found = [];
  const isRecipe = (o) => {
    const t = o && (o['@type'] || o.type);
    return Array.isArray(t) ? t.includes('Recipe') : t === 'Recipe';
  };
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (isRecipe(o)) { found.push(o); return; }
    if (o['@graph']) walk(o['@graph']);
  };
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try { walk(JSON.parse(s.textContent)); } catch (e) {}
  });
  const text = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : '');
  const crumbs = [...document.querySelectorAll('nav[aria-label*="read" i] a, .breadcrumb a, .breadcrumbs a, [class*="breadcrumb" i] a')]
    .map(text).filter(Boolean);
  const og = document.querySelector('meta[property="og:image"]');
  return { recipes: found, crumbs, ogImage: og ? og.content : '', h1: text(document.querySelector('h1')) };
}
"""


def as_list(value: Any) -> list[Any]:
    if value is None or value == "":
        return []
    return value if isinstance(value, list) else [value]


def flatten_strings(value: Any) -> list[str]:
    result: list[str] = []
    for item in as_list(value):
        if isinstance(item, list):
            result.extend(flatten_strings(item))
        elif isinstance(item, dict):
            result.extend(flatten_strings(item.get("name") or item.get("text")))
        elif item is not None:
            result.append(clean_text(item))
    return [x for x in result if x]


def instruction_steps(value: Any) -> list[str]:
    steps: list[str] = []
    for item in as_list(value):
        if isinstance(item, list):
            steps.extend(instruction_steps(item))
        elif isinstance(item, dict):
            if item.get("itemListElement"):
                steps.extend(instruction_steps(item["itemListElement"]))
            else:
                text = clean_text(item.get("text") or item.get("name"))
                if text:
                    steps.append(text)
        elif isinstance(item, str):
            # Some sites put all steps in one HTML/text blob.
            text = re.sub(r"<[^>]+>", "\n", item)
            steps.extend(clean_text(part) for part in text.split("\n") if clean_text(part))
    return steps


def pick_image(value: Any, fallback: str) -> str:
    for item in as_list(value):
        if isinstance(item, dict):
            item = item.get("url") or item.get("contentUrl") or ""
        if isinstance(item, list):
            item = item[0] if item else ""
        text = clean_text(item)
        if not text:
            continue
        # TV 2 writes a srcset ("url 144w, url 224w, ...") - take the largest.
        candidates = re.findall(r"(https?://\S+?)\s+(\d+)w", text)
        if candidates:
            return max(candidates, key=lambda c: int(c[1]))[0].rstrip(",")
        return text.split(" ")[0]
    return clean_text(fallback)


def iso_minutes(value: Any) -> str:
    text = clean_text(value)
    match = re.match(r"^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?", text, re.IGNORECASE)
    if not match or not (match.group(1) or match.group(2)):
        return text
    minutes = int(match.group(1) or 0) * 60 + int(match.group(2) or 0)
    return f"{minutes} min" if minutes else ""


def parse_servings(value: Any) -> tuple[Any, str]:
    for item in as_list(value):
        match = re.match(r"\s*(\d+(?:[.,]\d+)?)\s*(.*)", clean_text(item))
        if match:
            return parse_number(match.group(1)), clean_text(match.group(2))
    return "", ""


def grams_value(value: Any) -> Any:
    # "10,8 g" -> 10.8. Percentages and dashes are not grams and are left out.
    text = clean_text(value).lower()
    if not text or "%" in text:
        return ""
    match = re.match(r"(\d+(?:[.,]\d+)?)\s*(g|gram)?\b", text)
    return parse_number(match.group(1)) if match else ""


def kcal_value(value: Any) -> Any:
    text = clean_text(value).lower()
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*kcal", text) or re.match(r"(\d+(?:[.,]\d+)?)$", text)
    return parse_number(match.group(1)) if match else ""


def recipe_from_json_ld(data: dict[str, Any], page_info: dict[str, Any]) -> dict[str, Any]:
    nutrition = data.get("nutrition") if isinstance(data.get("nutrition"), dict) else {}
    lines = [{"section": "", "raw": raw} for raw in flatten_strings(data.get("recipeIngredient") or data.get("ingredients"))]
    return {
        "name": clean_text(data.get("name")) or page_info.get("h1", ""),
        "description": clean_text(re.sub(r"<[^>]+>", " ", str(data.get("description") or ""))),
        "yield": data.get("recipeYield"),
        "total": iso_minutes(data.get("totalTime")),
        "work": iso_minutes(data.get("prepTime")),
        "categories": flatten_strings(data.get("recipeCategory")),
        "keywords": [k for k in re.split(r"\s*,\s*", ", ".join(flatten_strings(data.get("keywords")))) if k],
        "cuisine": flatten_strings(data.get("recipeCuisine")),
        "lines": lines,
        "steps": instruction_steps(data.get("recipeInstructions")),
        "image": pick_image(data.get("image"), page_info.get("ogImage", "")),
        "nutrition": {
            "basis": clean_text(nutrition.get("servingSize")),
            "kcal": kcal_value(nutrition.get("calories")),
            "protein": grams_value(nutrition.get("proteinContent")),
            "carbs": grams_value(nutrition.get("carbohydrateContent")),
            "fat": grams_value(nutrition.get("fatContent")),
        },
        "crumbs": page_info.get("crumbs", []),
    }


def extract_raw(site: SiteConfig, page: Page) -> dict[str, Any] | None:
    info = page.evaluate(JSON_LD_JS)
    recipes = [r for r in info["recipes"] if r.get("recipeIngredient") or r.get("ingredients")]
    if recipes:
        return recipe_from_json_ld(recipes[0], info)
    if site.dom_extract_js:
        data = page.evaluate(site.dom_extract_js)
        if data and data.get("lines"):
            data.setdefault("crumbs", info.get("crumbs", []))
            data.setdefault("image", info.get("ogImage", ""))
            return data
    return None


def unique_title(state: ScrapeState, name: str) -> str:
    title, n = name, 2
    while title in state.titles:
        title = f"{name} ({n})"
        n += 1
    state.titles.add(title)
    return title


def apply_classification(recipe: dict[str, Any], raw: dict[str, Any] | None, contexts: set[str]) -> None:
    labels = []
    if raw:
        # Breadcrumbs are left out: they hold site sections like "Mad & Drikke".
        labels = raw.get("categories", []) + raw.get("keywords", [])
    else:
        labels = [clean_text(recipe.get("Site Category")), clean_text(recipe.get("Keywords"))]
    context_labels = [c.replace("-", " ") for c in sorted(contexts)]
    texts = [recipe.get("Recipe Name", ""), recipe.get("Description", ""), *labels, *context_labels]
    recipe["Child Friendly"] = "Børnevenlig" if is_child_friendly(texts, sorted(contexts)) else ""
    recipe["Meal Type"] = classify_meal_type(labels + context_labels, recipe.get("Recipe Name", ""))
    recipe["Category"] = ", ".join(sorted(contexts))


def extract_recipe(site: SiteConfig, page: Page, context: BrowserContext, state: ScrapeState, url: str) -> tuple[dict[str, Any], list[dict[str, Any]]] | None:
    raw = extract_raw(site, page)
    if raw is None:
        return None

    name = clean_text(raw["name"]) or slug_of(url)
    key = unique_title(state, name)
    servings, servings_unit = parse_servings(raw.get("yield"))
    image_url = clean_text(raw.get("image"))
    image_file = download_image(site, context, image_url, slug_of(url))

    ingredients = []
    for index, line in enumerate(raw["lines"], start=1):
        parsed = parse_ingredient_line(line["raw"])
        ingredients.append(
            {
                "HelloCal_Title": key,
                "Line No": index,
                "Section": clean_text(line.get("section")),
                "Raw Text": clean_text(line["raw"]),
                **parsed,
                "Source URL": url,
            }
        )

    nutrition = raw.get("nutrition") or {}
    recipe = {
        "HelloCal_Title": key,
        "Recipe Name": name,
        "Site Category": ", ".join(dedupe_preserve(raw.get("categories", []) + raw.get("crumbs", []))),
        "Keywords": ", ".join(dedupe_preserve(raw.get("keywords", []))),
        "Servings": servings,
        "Servings Unit": servings_unit,
        "Total Time": raw.get("total", ""),
        "Work Time": raw.get("work", ""),
        "Ingredient Count": len(ingredients),
        "Ingredients": "\n".join(
            (f"[{row['Section']}] " if row["Section"] else "") + row["Raw Text"] for row in ingredients
        ),
        "Instructions": "\n".join(f"{i}. {step}" for i, step in enumerate(raw.get("steps", []), start=1)),
        "Description": raw.get("description", ""),
        "Site Nutrition Basis": nutrition.get("basis", "") if nutrition.get("kcal") != "" else "",
        "Site Energy kcal": nutrition.get("kcal", ""),
        "Site Protein g": nutrition.get("protein", ""),
        "Site Carbohydrate g": nutrition.get("carbs", ""),
        "Site Fat g": nutrition.get("fat", ""),
        "Image File": image_file,
        "Image URL": image_url,
        "Source URL": url,
        "Parse Status": "ok" if raw.get("steps") else "no instructions",
    }
    apply_classification(recipe, raw, state.contexts.get(url, set()))
    return recipe, ingredients


# ============================================================
# Crawl: one listing at a time, each recipe scraped as soon as it is found
# ============================================================
def add_context(state: ScrapeState, url: str, label: str) -> None:
    if not label:
        return
    labels = state.contexts.setdefault(url, set())
    if label in labels:
        return
    labels.add(label)
    # A recipe already scraped from another listing gets the new label too.
    recipe = state.by_url.get(url)
    if recipe:
        apply_classification(recipe, None, labels)


def queue_recipe(state: ScrapeState, url: str) -> None:
    if url not in state.processed_urls and url not in state.skipped_urls and url not in state.pending_recipes:
        state.pending_recipes.append(url)


def scrape_recipe(site: SiteConfig, page: Page, context: BrowserContext, state: ScrapeState, url: str) -> None:
    if url in state.processed_urls or url in state.skipped_urls:
        return
    if not goto_with_retry(page, url):
        state.failed_urls.add(url)
        return
    try:
        result = extract_recipe(site, page, context, state, url)
    except Exception as exc:
        print(f"  Parse failed: {url} - {exc}")
        state.failed_urls.add(url)
        return

    # Related recipes linked from this page are followed later, so recipes
    # missing from the listings are still found.
    links = recipe_links(site, page)
    if result is None:
        state.skipped_urls.add(url)
        # A "recipe-looking" URL without a recipe is a theme page: its
        # recipes inherit its name as a category (e.g. "mad-for-born").
        for link in links:
            if link != url:
                add_context(state, link, slug_of(url))
                queue_recipe(state, link)
        print(f"  Skipped (no recipe on page, {len(links)} links followed): {url}")
        return

    for link in links:
        queue_recipe(state, link)
    recipe, ingredients = result
    state.recipes.append(recipe)
    state.by_url[url] = recipe
    state.ingredients.extend(ingredients)
    state.processed_urls.add(url)
    state.failed_urls.discard(url)
    if url in state.pending_recipes:
        state.pending_recipes.remove(url)
    flags = " ".join(x for x in (recipe["Meal Type"], recipe["Child Friendly"]) if x)
    print(f"  [{len(state.recipes)}] {recipe['Recipe Name']} ({len(ingredients)} ingredients) {flags}")
    if len(state.recipes) % CHECKPOINT_EVERY == 0:
        save_temp(site, state)


def scrape_found(site: SiteConfig, recipe_page: Page, context: BrowserContext, state: ScrapeState, urls: list[str], label: str) -> int:
    new = 0
    for url in urls:
        add_context(state, url, label)
        if url in state.processed_urls or url in state.skipped_urls:
            continue
        new += 1
        scrape_recipe(site, recipe_page, context, state, url)
    return new


def crawl_listing(site: SiteConfig, list_page: Page, recipe_page: Page, context: BrowserContext, state: ScrapeState,
                  url: str, label: str, follow_next: bool = True) -> None:
    """A listing page plus its rel=next pages."""
    listing_url = url
    for page_no in range(1, MAX_PAGES_PER_LISTING + 1):
        if listing_url in state.seen_listings:
            break
        if not goto_with_retry(list_page, listing_url):
            break
        found = recipe_links(site, list_page)
        next_url = next_page_url(site, list_page) if follow_next else ""
        print(f"Listing '{label or listing_url}' page {page_no}: {len(found)} recipe links")
        scrape_found(site, recipe_page, context, state, found, label)
        state.seen_listings.add(listing_url)
        save_temp(site, state)
        if not found or not next_url or next_url == listing_url:
            break
        listing_url = next_url


def crawl_paged(site: SiteConfig, list_page: Page, recipe_page: Page, context: BrowserContext, state: ScrapeState,
                label: str, url_for_page: Callable[[int], str]) -> None:
    """Listings addressed by page number; stops at the first page with no new links."""
    previous: list[str] = []
    for page_no in range(1, MAX_PAGES_PER_LISTING + 1):
        url = url_for_page(page_no)
        if url in state.seen_listings:
            continue
        if not goto_with_retry(list_page, url):
            break
        found = recipe_links(site, list_page)
        print(f"Listing '{label}' page {page_no}: {len(found)} recipe links")
        if not found or found == previous:
            state.seen_listings.add(url)
            break
        previous = found
        scrape_found(site, recipe_page, context, state, found, label)
        state.seen_listings.add(url)
        save_temp(site, state)


def crawl_load_more(site: SiteConfig, list_page: Page, recipe_page: Page, context: BrowserContext, state: ScrapeState,
                    url: str, label: str = "") -> None:
    """One listing expanded by clicking the "Vis flere" button. The listing
    stays open in its own tab while the recipes found so far are scraped in
    the recipe tab, so the list keeps its position."""
    if url in state.seen_listings or not goto_with_retry(list_page, url):
        return
    button = re.compile(site.load_more_label, re.IGNORECASE)
    stalled = 0
    for click in range(MAX_LOAD_MORE_CLICKS + 1):
        found = recipe_links(site, list_page)
        new = scrape_found(site, recipe_page, context, state, found, label)
        print(f"Listing '{label or url}' after {click} clicks: {len(found)} recipe links ({new} new)")
        if new:
            save_temp(site, state)
        locator = list_page.get_by_role("button", name=button)
        if locator.count() == 0 or not locator.first.is_visible():
            break
        clicked = False
        for attempt in range(3):
            try:
                # Cookie banners (TV 2's OneTrust) can load late and cover the button.
                handle_cookies(list_page)
                locator.first.scroll_into_view_if_needed()
                locator.first.click(timeout=10_000)
                list_page.wait_for_timeout(1_500)
                clicked = True
                break
            except Exception as exc:
                print(f"Load more click attempt {attempt + 1}/3 failed: {str(exc).splitlines()[0]}")
                list_page.wait_for_timeout(2_000)
        if not clicked:
            break
        stalled = stalled + 1 if len(recipe_links(site, list_page)) == len(found) else 0
        if stalled >= 3:
            break
    state.seen_listings.add(url)


def crawl_and_scrape(site: SiteConfig, list_page: Page, recipe_page: Page, context: BrowserContext, state: ScrapeState) -> None:
    try:
        # 1. Theme/category pages first, so their recipes get the category label.
        category_urls: list[str] = []
        for root in site.category_roots:
            if goto_with_retry(list_page, root):
                category_urls.extend(u for u in page_links(site, list_page) if re.match(site.category_url_re, u))
        category_urls = dedupe_preserve(category_urls)
        if category_urls:
            print(f"Discovered {len(category_urls)} category pages")
        for url in category_urls:
            crawl_listing(site, list_page, recipe_page, context, state, url, slug_of(url))

        # 2. The complete recipe listings.
        if site.filter_listings and site.plain_listings and goto_with_retry(list_page, site.plain_listings[0]):
            filters = site.filter_listings(list_page)
            print(f"Discovered {len(filters)} filter listings")
            for label, url in filters:
                crawl_load_more(site, list_page, recipe_page, context, state, url, label)

        for label, url_for_page in site.paged_listings:
            crawl_paged(site, list_page, recipe_page, context, state, label, url_for_page)
        for url in site.plain_listings:
            if site.load_more_label:
                crawl_load_more(site, list_page, recipe_page, context, state, url)
            else:
                crawl_listing(site, list_page, recipe_page, context, state, url, "")

        # 3. Recipes only found as "related recipe" links on other recipes.
        while state.pending_recipes:
            url = state.pending_recipes.pop(0)
            print(f"Linked recipe ({len(state.pending_recipes)} left): {url}")
            scrape_recipe(site, recipe_page, context, state, url)

        for url in sorted(state.failed_urls):
            print(f"Retrying failed recipe: {url}")
            scrape_recipe(site, recipe_page, context, state, url)
    except KeyboardInterrupt:
        save_temp(site, state)
        save_final_files(site, state)
        raise
    except Exception:
        save_temp(site, state)
        raise


def run(site: SiteConfig) -> None:
    # Show progress lines immediately in the terminal instead of buffering them.
    sys.stdout.reconfigure(line_buffering=True)
    for folder in (site.root_dir, site.images_dir, site.temp_dir):
        folder.mkdir(parents=True, exist_ok=True)
    state = load_temp(site)

    print(f"{site.display_name} recipe scraper started")
    print(f"Root: {site.root_dir}")
    print(f"Images: {site.images_dir}")
    print(f"Temp checkpoint folder: {site.temp_dir} ({site.checkpoint_pattern})")
    print("Recipe limit: none")
    print("Discovery mode: one listing at a time, each recipe scraped as it is found")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = create_context(browser)
        list_page = context.new_page()
        recipe_page = context.new_page()
        try:
            crawl_and_scrape(site, list_page, recipe_page, context, state)
            save_temp(site, state)
            save_final_files(site, state)
            child = sum(1 for r in state.recipes if r.get("Child Friendly"))
            print(f"Completed. Recipes saved: {len(state.recipes)} ({child} Børnevenlig)")
            for meal in MEAL_TYPES + [""]:
                count = sum(1 for r in state.recipes if clean_text(r.get("Meal Type")) == meal)
                print(f"  {meal or 'No meal type'}: {count}")
            print(f"Recipe file: {site.recipe_file}")
            print(f"Ingredient file: {site.ingredient_file}")
            print(f"Images saved directly in: {site.images_dir}")
            print(f"Next step: run recipe_sites_match.py {site.retailer} to calculate calories from the ingredients.")
        finally:
            context.close()
            browser.close()


def main(site: SiteConfig) -> None:
    try:
        run(site)
    except KeyboardInterrupt:
        print("Stopped by user.")
        sys.exit(130)

"""
HelloFreshs lande (docs/DECISIONS.md 2026-10-15, brugerens krav: "Hello Fresh
fra alle lande inkl. registrering af landet på retten").

Hver ret gemmes med sit land (products.market) og sit sprog (products.language).
Danmark beholder de gamle id'er (hf_<recipeId>, externalId = recipeId), så
eksisterende retter, favoritter og registreringer ikke flyttes. Andre lande får
hf_<land>_<recipeId> og externalId "<LAND>:<recipeId>" — HelloFreshs id'er kan
gå igen på tværs af lande, og ingredienserne har navne på hvert lands sprog.

Næringen står med hvert lands egne navne ("Fedt", "Fett", "Matières grasses"),
så makroerne findes ud fra en ordliste pr. sprog. Kan en ret ikke læses sikkert,
springes den over (aldrig gættede tal).
"""

MARKETS = [
    {"country": "DK", "site": "https://www.hellofresh.dk", "language": "da"},
    {"country": "SE", "site": "https://www.hellofresh.se", "language": "sv"},
    {"country": "NO", "site": "https://www.hellofresh.no", "language": "no"},
    {"country": "DE", "site": "https://www.hellofresh.de", "language": "de"},
    {"country": "AT", "site": "https://www.hellofresh.at", "language": "de"},
    {"country": "CH", "site": "https://www.hellofresh.ch", "language": "de"},
    {"country": "NL", "site": "https://www.hellofresh.nl", "language": "nl"},
    {"country": "BE", "site": "https://www.hellofresh.be", "language": "nl"},
    {"country": "FR", "site": "https://www.hellofresh.fr", "language": "fr"},
    {"country": "IT", "site": "https://www.hellofresh.it", "language": "it"},
    {"country": "ES", "site": "https://www.hellofresh.es", "language": "es"},
    {"country": "GB", "site": "https://www.hellofresh.co.uk", "language": "en"},
    {"country": "IE", "site": "https://www.hellofresh.ie", "language": "en"},
    {"country": "US", "site": "https://www.hellofresh.com", "language": "en"},
    {"country": "CA", "site": "https://www.hellofresh.ca", "language": "en"},
    {"country": "AU", "site": "https://www.hellofresh.com.au", "language": "en"},
    {"country": "NZ", "site": "https://www.hellofresh.co.nz", "language": "en"},
]


def is_denmark(market):
    return market["country"] == "DK"


def product_id(market, recipe_id):
    return f"hf_{recipe_id}" if is_denmark(market) else f"hf_{market['country'].lower()}_{recipe_id}"


def external_id(market, recipe_id):
    return recipe_id if is_denmark(market) else f"{market['country']}:{recipe_id}"


def recipe_id_from_external(market, value):
    if is_denmark(market):
        return value if value and ":" not in value else None
    prefix = f"{market['country']}:"
    return value[len(prefix):] if value and value.startswith(prefix) else None


def ingredient_ids(market, hf_ingredient_id):
    """(db-id, externalId) for en ingrediens i landet."""
    if is_denmark(market):
        return f"hf_ing_{hf_ingredient_id}", hf_ingredient_id
    cc = market["country"]
    return f"hf_ing_{cc.lower()}_{hf_ingredient_id}", f"{cc}:{hf_ingredient_id}"


def image_name(market, recipe_id):
    return recipe_id if is_denmark(market) else f"{market['country'].lower()}_{recipe_id}"


# --- Næring ------------------------------------------------------------------

# Navne (små bogstaver, uden parentes) pr. makro på HelloFresh-landenes sprog.
PROTEIN = {"protein", "proteiner", "eiweiß", "eiweiss", "eiwit", "eiwitten", "protéines", "proteines",
           "proteine", "proteínas", "proteinas"}
CARBS = {"kulhydrat", "kulhydrater", "kolhydrater", "karbohydrater", "karbohydrat", "kohlenhydrate",
         "koolhydraten", "glucides", "carboidrati", "carbohidratos", "hidratos de carbono", "carbohydrate",
         "carbohydrates", "carbs", "total carbohydrate"}
FAT = {"fedt", "fett", "fett total", "vet", "vetten", "matières grasses", "matieres grasses", "lipides",
       "grassi", "grasas", "fat", "total fat"}
SATURATED_FAT = {"mættet fedt", "heraf mættede fedtsyrer", "mättat fett", "mettet fett", "gesättigte fettsäuren",
                 "davon gesättigte fettsäuren", "verzadigd vet", "waarvan verzadigd", "acides gras saturés",
                 "dont acides gras saturés", "grassi saturi", "di cui acidi grassi saturi", "grasas saturadas",
                 "saturated fat", "saturates", "of which saturates"}
SUGAR = {"sukker", "heraf sukkerarter", "socker", "zucker", "davon zucker", "suikers", "waarvan suikers",
         "sucres", "dont sucres", "zuccheri", "di cui zuccheri", "azúcares", "azucares", "sugar", "sugars",
         "of which sugars", "total sugars"}
FIBER = {"kostfibre", "kostfiber", "ballaststoffe", "vezels", "voedingsvezel", "fibres", "fibres alimentaires",
         "fibre", "fibra", "dietary fiber", "fiber"}
SALT = {"salt", "salz", "zout", "sel", "sale", "sal", "sodium"}
CHOLESTEROL = {"kolesterol", "cholesterin", "cholesterol", "cholestérol", "colesterolo", "colesterol"}


def _label(name):
    """"Fedt (g)" -> "fedt"."""
    text = (name or "").lower()
    if "(" in text:
        text = text.split("(", 1)[0]
    return " ".join(text.replace(":", " ").split())


def read_nutrition(items):
    """HelloFreshs næringsliste -> (kcal, protein, kulhydrat, fedt, ekstra) eller None.

    kcal findes på enheden (kcal) eller navnet ("Kalorier (kcal)", "Energie (kcal)").
    Ekstra-nøglerne er de samme som før (saturatedFatG, sugarG …); "sodium"
    (mg) gemmes kun som salt, når det er angivet som salt.
    """
    kcal = protein = carbs = fat = None
    extra = {}
    for item in items or []:
        amount = item.get("amount")
        if not isinstance(amount, (int, float)):
            continue
        name = item.get("name") or ""
        unit = (item.get("unit") or "").strip().lower()
        label = _label(name)
        if unit == "kcal" or "kcal" in name.lower() or label in ("calories", "kalorier", "kalorien"):
            if unit != "kj" and "kj" not in name.lower():
                kcal = amount
            continue
        if label in PROTEIN:
            protein = amount
        elif label in CARBS:
            carbs = amount
        elif label in SATURATED_FAT:
            extra["saturatedFatG"] = amount
        elif label in FAT:
            fat = amount
        elif label in SUGAR:
            extra["sugarG"] = amount
        elif label in FIBER:
            extra["fiberG"] = amount
        elif label in SALT and label != "sodium":
            extra["saltG"] = amount
        elif label in CHOLESTEROL:
            extra["cholesterolMg"] = amount
        elif label == "potassium":
            extra["potassiumMg"] = amount
        elif label == "calcium":
            extra["calciumMg"] = amount
        elif label == "iron":
            extra["ironMg"] = amount
    if kcal is None or protein is None or carbs is None or fat is None:
        return None
    return kcal, protein, carbs, fat, extra

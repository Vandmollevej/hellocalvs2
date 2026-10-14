// Danske ord i ingredienslister — bruges af kvalitetskontrollen
// (src/lib/ingredient-text-quality.ts) til at rette typiske OCR-fejl
// ("krydderler" → "krydderier", "SFSAMFRØ" → "SESAMFRØ"). Et ord rettes kun,
// når det IKKE står her, og én typisk tegnforveksling gør det til et ord, der
// gør. Sammensatte ord dækkes af to ord efter hinanden ("soja" + "sauce").
// Native-kopi: native/.../screens/food/FoodLogic.kt (DANISH_INGREDIENT_VOCABULARY).
// Ingen imports med "@/": testes direkte med node --test.

export const DANISH_INGREDIENT_WORDS = [
  // Basis
  "vand", "sukker", "salt", "bordsalt", "havsalt", "olie", "fedt", "eddike", "mel", "gær", "honning", "sirup",
  "rapsolie", "solsikkeolie", "olivenolie", "palmeolie", "kokosolie", "sesamolie", "sojaolie", "plantefedt",
  "vegetabilsk", "vegetabilske", "animalsk", "margarine", "smør", "fløde", "mælk", "ost", "valle", "æg",
  "æggeblomme", "æggehvide", "kakao", "kakaosmør", "chokolade", "vanilje", "glukose", "fruktose", "dextrose",
  "maltodextrin", "laktose", "stivelse", "majsstivelse", "kartoffelstivelse", "modificeret", "rørsukker",
  // Allergener
  "soja", "sojabønner", "sojasauce", "sojalecithin", "sesam", "sesamfrø", "hvede", "hvedemel", "rug", "rugmel",
  "byg", "bygmalt", "havre", "havregryn", "spelt", "durum", "gluten", "jordnødder", "mandler", "hasselnødder",
  "valnødder", "cashewnødder", "nødder", "sennep", "sennepsfrø", "selleri", "fisk", "rejer", "lupin", "sulfit",
  "svovldioxid", "skaldyr", "bløddyr",
  // Krydderier og grønt
  "chili", "chilipeber", "peber", "paprika", "hvidløg", "løg", "ingefær", "krydderi", "krydderier", "krydderurter",
  "persille", "dild", "basilikum", "oregano", "timian", "rosmarin", "laurbær", "koriander", "spidskommen",
  "gurkemeje", "karry", "kanel", "muskat", "nellike", "anis", "fennikel", "tomat", "tomater", "tomatpuré",
  "kartofler", "kartoffel", "ris", "majs", "bønner", "ærter", "linser", "svampe", "champignon", "citron",
  "appelsin", "frugt", "grøntsager", "bær", "jordbær", "hindbær", "æble", "æbler", "pære", "banan", "rosiner",
  // Tilsætningsstoffer
  "citronsyre", "mælkesyre", "eddikesyre", "ascorbinsyre", "sorbinsyre", "kaliumsorbat", "natriumbenzoat",
  "mononatriumglutamat", "natrium", "kalium", "calcium", "magnesium", "jern", "zink", "vitamin", "vitaminer",
  "aroma", "aromaer", "naturlig", "naturlige", "farvestof", "konserveringsmiddel", "antioxidant", "emulgator",
  "fortykningsmiddel", "stabilisator", "surhedsregulerende", "middel", "midler", "smagsforstærker",
  "hævemiddel", "xanthangummi", "guargummi", "pektin", "gelatine", "lecithin", "acetyleret", "fosfat", "fosfater",
  // Tilberedning og øvrigt
  "fermenteret", "brygget", "tørret", "røget", "ristet", "kogt", "pulver", "ekstrakt", "koncentrat", "juice",
  "saft", "sauce", "pasta", "kød", "svinekød", "oksekød", "kylling", "bacon", "skinke", "pølse", "andel",
  "heraf", "indeholder", "kan", "spor", "af", "og", "med", "fra", "samt", "ingredienser", "sort", "hvid", "rød",
  "grøn", "gul", "hel", "hele", "knust", "hakket", "sukkerrør", "kokos", "oliven", "druer", "mynte", "lakrids",
] as const;

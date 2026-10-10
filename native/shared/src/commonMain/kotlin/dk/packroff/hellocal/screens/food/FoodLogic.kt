package dk.packroff.hellocal.screens.food

import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.ui.formatNumber
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

// Ports of the client-side helpers the web's product page uses (src/lib/*.ts).
// Pure logic, no UI.

/** new Intl.NumberFormat("da-DK", { maximumFractionDigits }) */
fun daNumber(value: Double, maxDigits: Int = 0): String = formatNumber(value, maxDigits, minDecimals = 0)

/** Math.round for doubles (half up like JS). */
fun jsRound(value: Double): Long = kotlin.math.floor(value + 0.5).toLong()

fun round1(value: Double): Double = kotlin.math.floor(value * 10 + 0.5) / 10

fun roundTo(value: Double, decimals: Int): Double {
    var factor = 1.0
    repeat(decimals) { factor *= 10 }
    return kotlin.math.floor(value * factor + 0.5) / factor
}

/** Plain number text without a trailing ".0" (JS String(number)). */
fun jsNumberText(value: Double): String =
    if (value == kotlin.math.floor(value) && kotlin.math.abs(value) < 1e15) value.toLong().toString() else value.toString()

// ---------------------------------------------------------------------------
// src/lib/product-display-unit.ts

enum class DisplayUnit(val label: String) { G("g"), ML("ml"), CL("cl") }

fun normalizeUnit(unit: String?): DisplayUnit? = when (unit?.trim()?.lowercase()) {
    "g", "gr", "gr.", "gram" -> DisplayUnit.G
    "ml", "milliliter", "dl", "l", "ltr", "liter" -> DisplayUnit.ML
    "cl", "centiliter" -> DisplayUnit.CL
    else -> null
}

private val PACKAGE_UNIT = Regex("\\d\\s*(ml|cl|dl|g|gr\\.?|gram|l|ltr|liter|milliliter|centiliter)(?![a-zæøå])", RegexOption.IGNORE_CASE)

fun unitFromPackageSize(text: String?): DisplayUnit? = text?.let { PACKAGE_UNIT.find(it)?.groupValues?.get(1) }?.let(::normalizeUnit)

/** Mængde angivet i cl = færdig drikkevare → altid cl, uanset kategori (brugerens regel 2026-10-10). */
fun productDisplayUnit(product: ProductDto?): DisplayUnit {
    val unit = unitFromPackageSize(product?.packageSizeText) ?: unitFromPackageSize(product?.name)
    if (unit == DisplayUnit.CL) return DisplayUnit.CL
    if (product?.productCategory != "DRINK") return DisplayUnit.G
    return DisplayUnit.ML
}

fun toDisplayAmount(base: Double, unit: DisplayUnit): Double = if (unit == DisplayUnit.CL) jsRound(base) / 10.0 else base

fun fromDisplayAmount(display: Double, unit: DisplayUnit): Double = if (unit == DisplayUnit.CL) jsRound(display * 10).toDouble() else display

// ---------------------------------------------------------------------------
// src/lib/default-amount.ts

private fun rx(pattern: String) = Regex(pattern, RegexOption.IGNORE_CASE)

private val TYPICAL_AMOUNTS: List<Pair<Regex, Double>> = listOf(
    rx("(øl|pilsner|lager|ipa|stout|porter|cider|shandy|radler)\\b") to 330.0,
    rx("(vin|rosé|champagne|cava|prosecco|crémant|cremant)\\b") to 150.0,
    rx("(portvin|sherry|vermouth|hedvin)\\b") to 50.0,
    rx("(snaps|\\bgin\\b|\\brom\\b|whisky|whiskey|vodka|akvavit|likør|spiritus|cognac|brandy|tequila|bitter)\\b") to 40.0,
    rx("(sodavand|cola|energidrik|lemonade|limonade|tonic|danskvand|kildevand|sportsdrik|iste|ice tea|\\bvand)\\b") to 330.0,
    rx("(juice|saft|smoothie|nektar|most)\\b") to 250.0,
    rx("(drikkeyoghurt|kærnemælk|havredrik|sojadrik|mandeldrik|risdrik|kakaomælk|chokolademælk|mælk|kakao)\\b") to 250.0,
    rx("(kaffe|\\bte\\b|latte|cappuccino|espresso)\\b") to 250.0,
    rx("(müsli|musli|mysli|granola|havregryn|cornflakes|morgenmad|cereal)") to 70.0,
    rx("(skyr|yoghurt|ymer|a38|kvark|fromage frais|cottage cheese|hytteost)") to 200.0,
    rx("(fløde|creme fraiche|crème fraîche|cremefraiche)") to 30.0,
    rx("\\bæg\\b|\\bæggene\\b") to 60.0,
    rx("(pålæg|skinke|hamburgerryg|spegepølse|rullepølse|salami|leverpostej|kalkunbryst|bacon|kyllingebryst i skiver)") to 25.0,
    rx("(smør|margarine|smørbar)") to 10.0,
    rx("(hummus|tapenade|pesto|tzatziki|dip)\\b") to 30.0,
    rx("(ost|brie|cheddar|mozzarella|feta|parmesan|gouda|danbo)\\b") to 25.0,
    rx("(rugbrød|franskbrød|brød|toast|bolle|bagel|pita|tortilla|wrap|knækbrød|riskiks)") to 50.0,
    rx("(chips|snacks|nødder|mandler|popcorn|peanuts|cashew)") to 40.0,
    rx("(rosiner|tørret frugt|dadler|abrikoser)") to 30.0,
    rx("(chokolade|slik|vingummi|lakrids|proteinbar|müslibar|bar\\b|bar$)") to 30.0,
    rx("(kiks|småkager|cookies|kage|wienerbrød|croissant|muffin)") to 50.0,
    rx("(\\bis\\b|flødeis|sorbet)") to 100.0,
    rx("(pizza)") to 350.0,
    rx("(lasagne|færdigret|ret til én|mikroret)") to 400.0,
    rx("(suppe)") to 300.0,
    rx("(pasta|spaghetti|ris|nudler|couscous|bulgur|quinoa)") to 90.0,
    rx("(kartoffel|kartofler|pommes frites)") to 200.0,
    rx("(hakket|hakkekød|oksekød|svinekød|kyllingebryst|kyllingefilet|kylling|kalkun|bøf|kotelet|mørbrad|steak)") to 150.0,
    rx("(laks|torsk|rejer|tun|fisk|sej|rødspætte|makrel|sild)") to 125.0,
    rx("(frikadelle|pølse|hotdog|burgerbøf)") to 75.0,
    rx("(banan)") to 120.0,
    rx("(æble|pære|appelsin|nektarin|fersken)") to 150.0,
    rx("(blåbær|hindbær|jordbær|vindruer|bær)") to 100.0,
    rx("(ketchup|mayonnaise|remoulade|dressing|sennep|sauce)") to 20.0,
    rx("(marmelade|syltetøj|honning|nutella|peanutbutter|jordnøddesmør)") to 20.0,
    rx("(olie|olivenolie|rapsolie)") to 10.0,
)

private val NOT_A_DRINK = rx("(fløde|madlavning|olie|eddike|sirup|sauce|dressing|bouillon|fond|marinade|ketchup|soja|kokosmælk|piskefløde|creme fraiche)")
private val DRINK_WORDS = rx("(øl|pilsner|lager|ipa|stout|porter|cider|vin|rosé|champagne|cava|prosecco|snaps|gin|rom|whisky|whiskey|vodka|akvavit|likør|spiritus|cognac|sodavand|cola|energidrik|lemonade|limonade|tonic|danskvand|kildevand|flaskevand|vand|juice|saft|smoothie|nektar|drik|iste|ice tea|shot|alkopop|cocktail|mojito|spritz)\\b")
private val WINE = rx("(vin|rosé|champagne|cava|prosecco|crémant|cremant|portvin|sherry|vermouth|hedvin)\\b")
private val SPIRIT = rx("(snaps|\\bgin\\b|\\brom\\b|whisky|whiskey|vodka|akvavit|likør|spiritus|cognac|brandy|tequila|bitter)\\b")
private val MIXED = rx("(tonic|cola|lemon|mix|&|\\bog\\b|soda|spritz|cocktail|mojito|shot|alkopop|ready to drink|rtd)")
private val VOLUME_PATTERN = rx("(\\d+(?:[.,]\\d+)?)\\s*(ml|cl|dl|l|ltr|liter)\\b")

private fun productText(p: ProductDto): String =
    (listOfNotNull(p.productType, p.name) + p.keywordList()).filter { it.isNotBlank() }.joinToString(" ")

fun packageVolumeMl(text: String?): Double? {
    val match = text?.let { VOLUME_PATTERN.find(it) } ?: return null
    val value = match.groupValues[1].replace(",", ".").toDoubleOrNull() ?: return null
    val factor = when (match.groupValues[2].lowercase()) {
        "ml" -> 1.0
        "cl" -> 10.0
        "dl" -> 100.0
        else -> 1000.0
    }
    val ml = value * factor
    return if (ml > 0) ml else null
}

private fun productVolumeMl(p: ProductDto) = packageVolumeMl(p.packageSizeText) ?: packageVolumeMl(p.name)

private fun alcoholPercent(p: ProductDto): Double? {
    val tags = p.dietaryTags as? JsonObject ?: return null
    if ((tags["isAlcoholFree"] as? JsonPrimitive)?.let { it.booleanOrNull == true || (it.isString && it.content.isNotEmpty()) } == true) return 0.0
    val text = (tags["pct"] as? JsonPrimitive)?.takeIf { it.isString }?.content?.trim() ?: ""
    if (text.isEmpty() || text.contains("fedt", ignoreCase = true)) return null
    val match = Regex("^(\\d+(?:[.,]\\d+)?)\\s*%$").find(text) ?: return null
    return match.groupValues[1].replace(",", ".").toDoubleOrNull()
}

private fun isDrinkProduct(p: ProductDto): Boolean {
    val text = productText(p)
    if (NOT_A_DRINK.containsMatchIn(text)) return false
    if (p.productCategory == "DRINK") return true
    return DRINK_WORDS.containsMatchIn(text) && productVolumeMl(p) != null
}

private fun drinkAmountMl(p: ProductDto): Double? {
    if (!isDrinkProduct(p)) return null
    val text = productText(p)
    val volume = productVolumeMl(p)
    val percent = alcoholPercent(p)
    val isSpirit = (percent != null && percent >= 20) || (percent == null && SPIRIT.containsMatchIn(text) && !MIXED.containsMatchIn(text))
    if (isSpirit) return if (volume != null && volume <= 100) volume else 40.0
    val isWine = WINE.containsMatchIn(text) && !MIXED.containsMatchIn(text)
    if (isWine) return if (volume != null && volume <= 250) volume else 150.0
    if (volume == null) return null
    return if (volume <= 500) volume else 250.0
}

private fun typicalAmountGrams(p: ProductDto): Double? {
    val text = productText(p)
    if (text.isNotEmpty()) TYPICAL_AMOUNTS.firstOrNull { it.first.containsMatchIn(text) }?.let { return it.second }
    return if (p.productCategory == "DRINK") 250.0 else null
}

private val INSTANT_COFFEE = rx("(instant|nescaf|neskaf|pulverkaffe|kaffepulver|granulatkaffe|frysetørret kaffe)")
private val WEIGHT_PATTERN = rx("(\\d+(?:[.,]\\d+)?)\\s*(kg|g)\\b")

fun packageWeightGrams(text: String?): Double? {
    val match = text?.let { WEIGHT_PATTERN.find(it) } ?: return null
    val value = match.groupValues[1].replace(",", ".").toDoubleOrNull() ?: return null
    val grams = if (match.groupValues[2].lowercase() == "kg") value * 1000 else value
    return if (grams > 0) grams else null
}

private fun packageContentGrams(p: ProductDto): Double? =
    packageWeightGrams(p.packageSizeText) ?: packageVolumeMl(p.packageSizeText) ?: packageWeightGrams(p.name)

fun defaultAmountGrams(p: ProductDto, handSizeGrams: Double?): Double {
    p.lastAmountGrams?.takeIf { it > 0 }?.let { return it }
    val amount = suggestedAmountGrams(p, handSizeGrams)
    val cap = packageContentGrams(p)
    return if (cap != null && amount > cap) cap else amount
}

private fun suggestedAmountGrams(p: ProductDto, handSizeGrams: Double?): Double {
    if (INSTANT_COFFEE.containsMatchIn(productText(p))) return 2.0
    val serving = p.servingSizeGrams?.takeIf { it > 0 }
    if (serving != null && p.servingSizeUnitSingular != null && p.servingSizeUnitPlural != null) return serving
    if (serving != null && Regex("skive", RegexOption.IGNORE_CASE).containsMatchIn(productText(p))) return serving
    if (handSizeGrams != null && handSizeGrams > 0) return handSizeGrams
    return drinkAmountMl(p) ?: typicalAmountGrams(p) ?: serving ?: 100.0
}

// ---------------------------------------------------------------------------
// src/lib/hand-sizes.ts

data class HandSize(val key: String, val wholeGrams: Int, val grams: Int, val lengthCm: Double?, val diameterCm: Double)

data class HandSizeItem(
    val id: String,
    val aliases: List<String>,
    val refuseKey: String,
    val allowCooked: Boolean = false,
    val exclude: Regex? = null,
    val sizes: List<HandSize>,
)

private val SIZE_KEYS = listOf("small", "medium", "large")

private fun handItem(id: String, aliases: List<String>, refusePercent: Int, refuseKey: String, dims: List<Triple<Double?, Double, Int>>, allowCooked: Boolean = false, exclude: Regex? = null) =
    HandSizeItem(
        id = id,
        aliases = aliases,
        refuseKey = refuseKey,
        allowCooked = allowCooked,
        exclude = exclude,
        sizes = dims.mapIndexed { i, (len, d, g) ->
            HandSize(SIZE_KEYS[i], g, (g * (1 - refusePercent / 100.0)).let { jsRound(it).toInt() }, len, d)
        },
    )

private fun rnd(vararg v: Pair<Double, Int>) = v.map { Triple<Double?, Double, Int>(null, it.first, it.second) }
private fun lng(vararg v: Triple<Double, Double, Int>) = v.map { Triple<Double?, Double, Int>(it.first, it.second, it.third) }

val HAND_SIZE_ITEMS: List<HandSizeItem> = listOf(
    handItem("apple", listOf("æble", "æbler"), 10, "core", rnd(6.5 to 135, 7.5 to 185, 8.5 to 255)),
    handItem("orange", listOf("appelsin", "appelsiner"), 27, "peel", rnd(6.5 to 150, 7.5 to 205, 8.5 to 275)),
    handItem("mandarin", listOf("mandarin", "mandariner", "satsuma", "satsumas"), 26, "peel", rnd(5.0 to 75, 6.0 to 100, 7.0 to 135)),
    handItem("clementine", listOf("klementin", "klementiner", "clementin", "clementiner"), 23, "peel", rnd(5.0 to 65, 5.5 to 85, 6.5 to 110)),
    handItem("peach", listOf("fersken", "ferskner", "fladfersken", "fladferskner"), 4, "pit", rnd(6.0 to 115, 7.0 to 150, 8.0 to 195)),
    handItem("nectarine", listOf("nektarin", "nektariner"), 9, "pit", rnd(5.5 to 110, 6.5 to 150, 7.5 to 185)),
    handItem("plum", listOf("blomme", "blommer"), 6, "pit", rnd(4.0 to 45, 5.0 to 65, 6.0 to 90)),
    handItem("apricot", listOf("abrikos", "abrikoser"), 7, "pit", rnd(3.5 to 30, 4.5 to 40, 5.5 to 55)),
    handItem("fig", listOf("figen", "figner"), 1, "stem", rnd(4.0 to 40, 5.0 to 50, 6.0 to 65)),
    handItem("persimmon", listOf("sharonfrugt", "sharonfrugter", "kaki", "kakifrugt", "persimmon"), 16, "peelCalyx", rnd(6.0 to 155, 7.0 to 200, 8.0 to 260)),
    handItem("banana", listOf("banan", "bananer"), 36, "peel", lng(Triple(16.0, 3.2, 155), Triple(19.0, 3.5, 185), Triple(22.0, 3.8, 220))),
    handItem("pear", listOf("pære", "pærer"), 10, "core", lng(Triple(8.0, 6.0, 145), Triple(10.0, 6.5, 190), Triple(12.0, 7.5, 255))),
    handItem("kiwi", listOf("kiwi", "kiwier", "kiwifrugt", "kiwifrugter"), 14, "peel", lng(Triple(5.5, 4.5, 65), Triple(6.5, 5.0, 80), Triple(7.5, 5.5, 105))),
    handItem("carrot", listOf("gulerod", "gulerødder"), 11, "topPeel", lng(Triple(15.0, 2.5, 55), Triple(18.0, 3.0, 80), Triple(21.0, 3.5, 105))),
    handItem("snack-cucumber", listOf("snackagurk", "snackagurker", "minimagurk", "minimagurker", "miniagurk", "miniagurker"), 3, "ends", lng(Triple(10.0, 2.5, 50), Triple(13.0, 3.0, 70), Triple(16.0, 3.5, 105))),
    handItem("snack-pepper", listOf("snackpeberfrugt", "snackpeberfrugter", "snack peberfrugt", "minipeberfrugt", "minipeberfrugter"), 18, "stemSeeds", lng(Triple(7.0, 3.0, 25), Triple(9.0, 3.5, 35), Triple(11.0, 4.0, 50))),
    handItem("celery", listOf("bladselleri", "selleristang", "selleristænger", "stilkselleri"), 11, "ends", lng(Triple(20.0, 2.0, 35), Triple(25.0, 2.5, 45), Triple(30.0, 3.0, 65))),
    handItem("tomato", listOf("tomat", "tomater"), 9, "stemEnd", rnd(5.0 to 65, 6.5 to 130, 8.0 to 200)),
    handItem(
        "egg", listOf("æg", "hønseæg", "høneæg"), 12, "shell",
        lng(Triple(5.3, 4.0, 48), Triple(5.7, 4.3, 58), Triple(6.0, 4.5, 68)),
        allowCooked = true,
        exclude = rx("(hvide|blomme|pulver|salat|røræg|omelet|kage|nudl|pasta|vagtel|ande|gåse|struds)"),
    ),
)

private val PROCESSED = rx("(tørre|tørret|juice|saft|nektar\\b|konserv|dåse|syltet|kompot|sirup|lage|mos\\b|puré|pure\\b|frost|frossen|frosne|chips|marmelade|syltetøj|smoothie|pulver|kage|tærte|is\\b)")
private val COOKED = rx("(kogt|stegt|bagt|grillet|dampet|ovnbagt)")
private val LEADING_WORDS = Regex("^(økologisk[e]?|øko|dansk[e]?|frisk[e]?|hel[e]?)\\s+")

fun findHandSizeItem(name: String?): HandSizeItem? {
    if (name.isNullOrBlank()) return null
    var first = name.split(",").first().trim().lowercase().replace(Regex("\\s+"), " ")
    repeat(3) { if (LEADING_WORDS.containsMatchIn(first)) first = first.replaceFirst(LEADING_WORDS, "") }
    if (first.isEmpty()) return null
    val item = HAND_SIZE_ITEMS.firstOrNull { first in it.aliases } ?: return null
    if (PROCESSED.containsMatchIn(name)) return null
    if (!item.allowCooked && COOKED.containsMatchIn(name)) return null
    if (item.exclude?.containsMatchIn(name) == true) return null
    return item
}

fun mediumHandSizeGrams(name: String?): Double? = findHandSizeItem(name)?.sizes?.get(1)?.grams?.toDouble()

fun handSizeImageScale(size: HandSize, item: HandSizeItem): Double {
    val largest = item.sizes[2].wholeGrams
    return if (largest > 0) size.wholeGrams.toDouble() / largest else 1.0
}

fun formatHandSizeDimensions(size: HandSize): String =
    if (size.lengthCm == null) "Ø${daNumber(size.diameterCm, 1)} cm" else "${daNumber(size.lengthCm, 1)} × Ø${daNumber(size.diameterCm, 1)} cm"

// ---------------------------------------------------------------------------
// src/lib/product-naming.ts — H1/H2 split (the flavour variant only in H2).

private val AMPERSAND_WORDS = setOf("&", "og", "and", "+")
private val DANGLING_WORDS = setOf("&", "og", "and", "+", "med", "with", "m", "i", "in", "smag", "flavour", "flavor")

private data class Token(val norm: String, val start: Int, val end: Int)

private fun isWordChar(c: Char) = c.isLetterOrDigit() || c == '%'

/** Words ([letters/digits/%] with ".5"/",5" decimals) and the binders & and +. */
private fun tokenize(text: String): List<Token> {
    val tokens = mutableListOf<Token>()
    var i = 0
    while (i < text.length) {
        val c = text[i]
        if (c == '&' || c == '+') {
            tokens += Token("&", i, i + 1)
            i++
            continue
        }
        if (!isWordChar(c)) {
            i++
            continue
        }
        val start = i
        while (i < text.length && isWordChar(text[i])) i++
        while (i + 1 < text.length && (text[i] == '.' || text[i] == ',') && text[i + 1].isDigit()) {
            i++
            while (i < text.length && text[i].isDigit()) i++
        }
        val raw = text.substring(start, i).lowercase()
        tokens += Token(if (raw in AMPERSAND_WORDS) "&" else raw, start, i)
    }
    return tokens
}

fun removeVariantPhrase(text: String, phrase: String): String {
    val needle = tokenize(phrase)
    if (needle.none { it.norm != "&" }) return text
    var result = text
    while (true) {
        val hay = tokenize(result)
        var found = -1
        var i = 0
        while (i + needle.size <= hay.size) {
            if (needle.indices.all { j -> hay[i + j].norm == needle[j].norm }) {
                found = i
                break
            }
            i++
        }
        if (found < 0) return result
        val start = hay[found].start
        val end = hay[found + needle.size - 1].end
        result = result.substring(0, start) + " " + result.substring(end)
    }
}

private val EDGE_CHARS = " \t\n,.;:·-–—/|"
private val END_CHARS = " \t\n,;:·-–—/|"

private fun tidyTitle(text: String): String {
    var title = text
        .replace(Regex("\\(\\s*\\)"), " ")
        .replace(Regex("(\\s[-–—·/|])(?:\\s+[-–—·/|,])+(?=\\s)"), "$1")
        .replace(Regex("\\s+([,.;:])"), "$1")
        .replace(Regex("\\s{2,}"), " ")
        .trim()
    while (true) {
        val before = title
        title = title.trimStart { it in EDGE_CHARS }.trimEnd { it in END_CHARS }
        val tokens = tokenize(title)
        val last = tokens.lastOrNull()
        if (last != null && tokens.size > 1 && last.norm in DANGLING_WORDS && last.end == title.length) title = title.substring(0, last.start)
        val first = tokens.firstOrNull()
        if (first != null && tokens.size > 1 && first.norm == "&" && first.start == 0) title = title.substring(first.end)
        if (title == before) break
    }
    return title.trim()
}

private fun containsPhrase(outer: String, inner: String) = removeVariantPhrase(outer, inner) != outer

private fun samePhrase(a: String, b: String): Boolean {
    val ta = tokenize(a).joinToString(" ") { it.norm }
    val tb = tokenize(b).joinToString(" ") { it.norm }
    return ta.isNotEmpty() && ta == tb
}

private fun capitalizeFirst(text: String) = if (text.isEmpty()) text else text.substring(0, 1).uppercase() + text.substring(1)

fun normalizeProductType(productType: String) = if (productType.trim().lowercase() == "vand") "Flaskevand" else productType

data class ProductHeading(val title: String, val variants: List<String>)

fun splitProductHeading(product: ProductDto): ProductHeading {
    val variants = mutableListOf<String>()
    for (candidate in listOf(product.variant, product.flavor)) {
        val value = candidate?.trim()
        if (value.isNullOrEmpty() || tokenize(value).none { it.norm != "&" }) continue
        if (variants.any { containsPhrase(it, value) }) continue
        val covered = variants.indexOfFirst { containsPhrase(value, it) }
        if (covered >= 0) variants[covered] = value else variants += value
    }
    var title = product.name
    for (variant in variants) title = removeVariantPhrase(title, variant)
    title = tidyTitle(title)
    if (title.isEmpty()) {
        val productType = product.productType?.trim()
        if (!productType.isNullOrEmpty() && variants.none { samePhrase(it, productType) }) {
            var typeTitle: String = productType
            for (variant in variants) typeTitle = removeVariantPhrase(typeTitle, variant)
            typeTitle = tidyTitle(typeTitle)
            if (typeTitle.isNotEmpty()) return ProductHeading(capitalizeFirst(normalizeProductType(typeTitle)), variants)
        }
        return ProductHeading(product.name.trim(), emptyList())
    }
    return ProductHeading(capitalizeFirst(title), variants)
}

// ---------------------------------------------------------------------------
// src/lib/product-certifications.ts — certifications in the name become logos.

enum class NameCertification(val file: String, val label: String) {
    Organic("oekologimaerket.png", "Økologisk"),
    Keyhole("noeglehul.png", "Nøglehulsmærket"),
    Fairtrade("fairtrade.png", "Fairtrade"),
    Msc("msc.png", "MSC"),
}

private val NAME_CERT_WORDS: List<Pair<NameCertification, List<String>>> = listOf(
    NameCertification.Organic to listOf("økologiske", "økologisk", "øko.", "øko", "oeko", "organic", "bio.", "bio"),
    NameCertification.Keyhole to listOf("nøglehulsmærket", "nøglehul"),
    NameCertification.Fairtrade to listOf("fair trade", "fairtrade"),
    NameCertification.Msc to listOf("msc-mærket", "msc"),
)

private fun removeWholeWord(text: String, word: String): Pair<String, Boolean> {
    var result = text
    var found = false
    var from = 0
    while (true) {
        val idx = result.indexOf(word, from, ignoreCase = true)
        if (idx < 0) break
        val beforeOk = idx == 0 || !result[idx - 1].isLetterOrDigit()
        val endIdx = idx + word.length
        val afterOk = endIdx >= result.length || !result[endIdx].isLetterOrDigit() || word.endsWith(".")
        if (beforeOk && afterOk) {
            result = result.substring(0, idx) + result.substring(endIdx)
            found = true
            from = idx
        } else {
            from = idx + 1
        }
    }
    return result to found
}

fun extractCertifications(name: String): Pair<String, List<NameCertification>> {
    var title = name
    val certifications = mutableListOf<NameCertification>()
    for ((cert, words) in NAME_CERT_WORDS) {
        var any = false
        for (word in words) {
            val (next, found) = removeWholeWord(title, word)
            if (found) {
                title = next
                any = true
            }
        }
        if (any) certifications += cert
    }
    title = title.replace(Regex("\\s{2,}"), " ").trimStart { it in " ,.-–" }.trimEnd { it in " ,-–" }.trim()
    if (title.isEmpty()) return name to certifications
    return capitalizeFirst(title) to certifications
}

// ---------------------------------------------------------------------------
// src/lib/certification-badges.ts

data class CertificationBadge(val kind: String, val label: String, var imageUrl: String? = null)

private val CERTIFICATION_LOGO_FILES = mapOf(
    "organic" to "oekologimaerket.png", "euOrganic" to "eu-oekologi.png", "bioGermany" to "bio-tyskland.png",
    "landbau" to "oekologischer-landbau.png", "bioland" to "bioland.png", "keyhole" to "noeglehul.png",
    "wholeGrain" to "fuldkorn.png", "welfare1" to "bedre-dyrevelfaerd-1.png", "welfare2" to "bedre-dyrevelfaerd-2.png",
    "welfare3" to "bedre-dyrevelfaerd-3.png", "animalProtection" to "dyrenes-beskyttelse.png", "naturSkaansom" to "naturskaansom.png",
    "msc" to "msc.png", "asc" to "asc.png", "fairtrade" to "fairtrade.png", "rainforest" to "rainforest-alliance.png",
    "utz" to "utz.png", "krav" to "krav.png", "naturland" to "naturland.png", "vLabel" to "v-label.png", "vegan" to "vegan.png",
    "vegansk" to "vegansk.png", "tierwohl" to "tierwohl.png", "haltungsform" to "haltungsform.png",
    "heimischerAnbau" to "heimischer-anbau.png", "dlg" to "dlg.png", "glutenFree" to "glutenfri.png",
    "noChickCull" to "eier-ohne-kuekentoeten.png", "danskMaelk" to "dansk-maelk.png", "pgi" to "pgi.png", "granaPadano" to "grana-padano.png",
)

fun certificationLogoSrc(kind: String): String? = CERTIFICATION_LOGO_FILES[kind]?.let { "/certifications/$it" }

private fun word(value: String, w: String) = Regex("\\b$w\\b").containsMatchIn(value)

private fun kindForOrganic(label: String): String {
    val value = label.lowercase()
    if (value.contains("bioland")) return "bioland"
    if (value.contains("landbau")) return "landbau"
    if (value.contains("biologisch") || word(value, "bio")) return "bioGermany"
    if (word(value, "eu") || (value.contains("eu") && !value.contains("økolog"))) return "euOrganic"
    return "organic"
}

private fun kindForAnimalWelfare(label: String): String {
    val value = label.lowercase()
    if (value.contains("dyrenes beskyttelse")) return "animalProtection"
    if (value.contains("tierwohl")) return "tierwohl"
    if (value.contains("haltungsform")) return "haltungsform"
    if (value.contains("dyrevelfærd")) {
        when (Regex("[123]").find(value)?.value) {
            "1" -> return "welfare1"
            "2" -> return "welfare2"
            "3" -> return "welfare3"
        }
    }
    return "generic"
}

private fun kindForCertification(label: String): String {
    val value = label.lowercase()
    return when {
        word(value, "msc") -> "msc"
        word(value, "asc") -> "asc"
        value.contains("fairtrade") || value.contains("fair trade") -> "fairtrade"
        value.contains("rainforest") -> "rainforest"
        word(value, "utz") -> "utz"
        word(value, "krav") -> "krav"
        value.contains("naturland") -> "naturland"
        value.contains("v-label") || value.contains("vlabel") -> "vLabel"
        value.contains("vegansk") -> "vegansk"
        value.contains("vegan") -> "vegan"
        value.contains("tierwohl") -> "tierwohl"
        value.contains("haltungsform") -> "haltungsform"
        value.contains("heimischer anbau") -> "heimischerAnbau"
        word(value, "dlg") -> "dlg"
        value.contains("glutenfri") || value.contains("gluten free") || value.contains("gluten-free") -> "glutenFree"
        value.contains("kükentöten") || value.contains("kuekentoeten") -> "noChickCull"
        value.contains("dansk mælk") || value.contains("dansk maelk") -> "danskMaelk"
        Regex("\\b(?:pgi|pdo)\\b").containsMatchIn(value) || value.contains("beskyttet geografisk") -> "pgi"
        value.contains("grana padano") -> "granaPadano"
        value.contains("bioland") -> "bioland"
        value.contains("naturskånsom") || value.contains("natur skånsom") || value.contains("naturskaansom") -> "naturSkaansom"
        value.contains("dyrenes beskyttelse") || value.contains("dyrevelfærd") -> kindForAnimalWelfare(label)
        value.contains("økolog") || value.contains("organic") || value.contains("bio") -> kindForOrganic(label)
        else -> "generic"
    }
}

private fun kindForLabel(label: ProductLabelView): String = when {
    label.key == "keyhole" -> "keyhole"
    label.key == "whole-grain" -> "wholeGrain"
    label.key == "organic-eu" -> "euOrganic"
    label.key == "organic-de" -> "bioGermany"
    label.key == "organic-dk" -> "organic"
    label.key == "dyrenes-beskyttelse" -> "animalProtection"
    label.key.startsWith("bedre-dyrevelfaerd-") -> kindForAnimalWelfare("Bedre Dyrevelfærd ${label.key.takeLast(1)}")
    else -> kindForCertification(label.name)
}

fun certificationBadges(filters: CertificationFilters?, labels: List<ProductLabelView>): List<CertificationBadge> {
    if (filters == null && labels.isEmpty()) return emptyList()
    val f = filters ?: CertificationFilters()
    val badges = mutableListOf<CertificationBadge>()
    f.organic?.trim()?.takeIf { it.isNotEmpty() }?.let { badges += CertificationBadge(kindForOrganic(it), it) }
    f.keyhole?.trim()?.takeIf { it.isNotEmpty() }?.let { badges += CertificationBadge("keyhole", it) }
    f.wholeGrain?.trim()?.takeIf { it.isNotEmpty() }?.let { badges += CertificationBadge("wholeGrain", it) }
    for (label in f.animalWelfare.orEmpty()) if (label.isNotBlank()) badges += CertificationBadge(kindForAnimalWelfare(label), label.trim())
    for (label in f.certifications.orEmpty()) if (label.isNotBlank()) badges += CertificationBadge(kindForCertification(label), label.trim())
    for (label in labels) {
        if (label.confidence < 0.8) continue
        val match = badges.firstOrNull { it.label.lowercase() == label.name.lowercase() }
        if (match != null) {
            if (label.imageUrl != null && match.imageUrl == null) match.imageUrl = label.imageUrl
            continue
        }
        badges += CertificationBadge(kindForLabel(label), label.name, label.imageUrl)
    }
    val seen = mutableSetOf<String>()
    return badges.filter { seen.add(it.label.lowercase()) }
}

// ---------------------------------------------------------------------------
// src/lib/allergens.ts + src/lib/allergen-highlight.ts

private val ALLERGEN_LABELS = mapOf(
    "gluten" to "Gluten", "crustaceans" to "Skaldyr", "eggs" to "Æg", "fish" to "Fisk", "peanuts" to "Jordnødder",
    "soybeans" to "Soja", "milk" to "Mælk", "nuts" to "Nødder", "celery" to "Selleri", "mustard" to "Sennep",
    "sesame-seeds" to "Sesamfrø", "sulphur-dioxide-and-sulphites" to "Svovldioxid og sulfitter", "lupin" to "Lupin",
    "molluscs" to "Bløddyr",
)

fun labelForAllergen(key: String): String = ALLERGEN_LABELS[key] ?: key

private val ALLERGEN_STEMS = listOf(
    "gluten", "rugmel", "rugkern", "rugbrød", "rugflager", "bygmel", "byggryn", "bygmalt", "hvede", "wheat", "rug", "rye", "byg", "barley", "havre", "oat", "spelt", "kamut", "durum", "semulje",
    "skaldyr", "krebsdyr", "rejer", "reje", "krabbe", "hummer", "shrimp", "crab", "lobster",
    "bløddyr", "muslinger", "musling", "østers", "blæksprutte", "mollus",
    "æg", "egg", "fisk", "fish", "torsk", "laks", "tun", "sild", "ansjos",
    "mælk", "milk", "fløde", "smør", "ost", "valle", "laktose", "kasein", "yoghurt", "skyr", "cream", "butter", "cheese", "whey", "lactose", "casein",
    "jordnød", "peanut", "nød", "nødde", "nut", "mandel", "mandler", "almond", "hasselnød", "hazelnut", "valnød", "walnut",
    "cashew", "pekan", "pecan", "pistacie", "pistachio", "paranød", "macadamia",
    "soja", "soy", "selleri", "celery", "sennep", "mustard", "sesam", "sesame", "lupin",
    "sulfit", "sulphit", "sulfite", "svovldioxid", "sulphur dioxide", "sulfur dioxide",
).sortedByDescending { it.length }

private val EXACT_ONLY = setOf("rug", "byg", "ost", "tun", "nut", "oat", "egg", "æg", "nød", "rye", "soy")
private const val ALLERGEN_LETTERS = "abcdefghijklmnopqrstuvwxyzæøåäöüé"

private fun isAllergenLetter(c: Char) = c.lowercaseChar() in ALLERGEN_LETTERS

data class IngredientSegment(val text: String, val allergen: Boolean)

/** Splits an ingredient list into plain and allergen parts (EU 1169/2011 art. 21). */
fun segmentIngredients(text: String): List<IngredientSegment> {
    val segments = mutableListOf<IngredientSegment>()
    var last = 0
    var i = 0
    while (i < text.length) {
        if (i > 0 && isAllergenLetter(text[i - 1])) {
            i++
            continue
        }
        var matchEnd = -1
        for (stem in ALLERGEN_STEMS) {
            if (!text.regionMatches(i, stem, 0, stem.length, ignoreCase = true)) continue
            var end = i + stem.length
            if (stem in EXACT_ONLY) {
                for (suffix in listOf("er", "ne", "s", "g")) {
                    if (text.regionMatches(end, suffix, 0, suffix.length, ignoreCase = true) &&
                        (end + suffix.length >= text.length || !isAllergenLetter(text[end + suffix.length]))
                    ) {
                        end += suffix.length
                        break
                    }
                }
                if (end < text.length && isAllergenLetter(text[end])) continue
            } else {
                while (end < text.length && isAllergenLetter(text[end])) end++
            }
            matchEnd = end
            break
        }
        if (matchEnd > i) {
            if (i > last) segments += IngredientSegment(text.substring(last, i), false)
            segments += IngredientSegment(text.substring(i, matchEnd), true)
            last = matchEnd
            i = matchEnd
        } else {
            i++
        }
    }
    if (last < text.length) segments += IngredientSegment(text.substring(last), false)
    return segments
}

// ---------------------------------------------------------------------------
// src/lib/additives.ts — the E-number table (/api/additives), fetched once.

data class AdditiveInfo(
    val eNumber: String,
    val internationalName: String,
    val danishName: String,
    val function: String,
    val risks: String,
    val research: String,
    val link: String,
    val source: String,
)

object Additives {
    private var cache: Map<String, AdditiveInfo>? = null
    private val mutex = Mutex()

    private suspend fun load(): Map<String, AdditiveInfo> = mutex.withLock {
        cache?.let { return it }
        val rows = Api.get("/api/additives").arr("additives") ?: JsonArray(emptyList())
        val map = rows.mapNotNull { row ->
            val code = row.str("eNumber") ?: return@mapNotNull null
            code.uppercase() to AdditiveInfo(
                eNumber = code,
                internationalName = row.str("internationalName") ?: "",
                danishName = row.str("danishName") ?: "",
                function = row.str("function") ?: "",
                risks = row.str("risks") ?: "",
                research = row.str("research") ?: "",
                link = row.str("link") ?: "",
                source = row.str("source") ?: "",
            )
        }.toMap()
        cache = map
        map
    }

    suspend fun info(code: String): AdditiveInfo {
        val normalized = code.uppercase()
        return runCatching { load()[normalized] }.getOrNull() ?: AdditiveInfo(
            eNumber = normalized,
            internationalName = "Ukendt tilsætningsstof",
            danishName = "",
            function = "",
            risks = "Vi har endnu ikke data om dette tilsætningsstof.",
            research = "",
            link = "",
            source = "",
        )
    }
}

data class IngredientTextPart(val text: String, val code: String? = null)

private val E_NUMBER = Regex("\\bE[\\s-]?(\\d{3,4}[a-z]?(?:\\([iv]+\\))?)(?![\\w])", RegexOption.IGNORE_CASE)

fun splitENumbers(text: String): List<IngredientTextPart> {
    val parts = mutableListOf<IngredientTextPart>()
    var last = 0
    for (match in E_NUMBER.findAll(text)) {
        val start = match.range.first
        if (start > last) parts += IngredientTextPart(text.substring(last, start))
        val code = ("E" + match.groupValues[1].replace(Regex("\\(.*\\)$"), "")).uppercase()
        parts += IngredientTextPart(match.value, code)
        last = match.range.last + 1
    }
    if (last < text.length) parts += IngredientTextPart(text.substring(last))
    return parts
}

// ---------------------------------------------------------------------------
// src/lib/toxins.ts matchToxins

data class ToxinMatch(val toxin: ToxinInfo, val matchedTerm: String)

private const val TOXIN_LETTERS = "abcdefghijklmnopqrstuvwxyz0123456789æøåäöüé"

private fun termMatches(text: String, term: String): Boolean {
    if (!term.startsWith("=")) return text.contains(term)
    val word = term.substring(1)
    var from = 0
    while (true) {
        val idx = text.indexOf(word, from)
        if (idx < 0) return false
        val beforeOk = idx == 0 || text[idx - 1] !in TOXIN_LETTERS
        val end = idx + word.length
        val afterOk = end >= text.length || text[end] !in TOXIN_LETTERS
        if (beforeOk && afterOk) return true
        from = idx + 1
    }
}

fun matchToxins(vararg texts: String?): List<ToxinMatch> {
    val text = texts.filterNotNull().filter { it.isNotEmpty() }.joinToString(" \n ").lowercase()
    if (text.isBlank()) return emptyList()
    val matches = mutableListOf<ToxinMatch>()
    for (toxin in FoodReferenceData.toxins) {
        if (toxin.excludeIf.any { text.contains(it) }) continue
        val hit = toxin.terms.firstOrNull { termMatches(text, it) } ?: continue
        matches += ToxinMatch(toxin, hit.removePrefix("="))
    }
    return matches.sortedBy { if (it.toxin.pregnancy != null || it.toxin.fertility != null) 0 else 1 }
}

// ---------------------------------------------------------------------------
// src/lib/nutrients.ts — units/digits per nutrient key.

data class NutrientDef(val unit: String, val digits: Int)

val NUTRIENT_DEFS: Map<String, NutrientDef> = mapOf(
    "saturatedFat" to NutrientDef("g", 1), "unsaturatedFat" to NutrientDef("g", 1), "transFat" to NutrientDef("g", 2),
    "cholesterol" to NutrientDef("mg", 0), "sugar" to NutrientDef("g", 1), "fiber" to NutrientDef("g", 1),
    "salt" to NutrientDef("g", 1), "sodium" to NutrientDef("mg", 0), "potassium" to NutrientDef("mg", 0),
    "calcium" to NutrientDef("mg", 0), "magnesium" to NutrientDef("mg", 0), "iron" to NutrientDef("mg", 1),
    "zinc" to NutrientDef("mg", 1), "copper" to NutrientDef("mg", 2), "manganese" to NutrientDef("mg", 2),
    "selenium" to NutrientDef("µg", 0), "phosphorus" to NutrientDef("mg", 0), "iodine" to NutrientDef("µg", 0),
    "vitaminA" to NutrientDef("µg", 0), "vitaminC" to NutrientDef("mg", 0), "vitaminD" to NutrientDef("µg", 1),
    "vitaminE" to NutrientDef("mg", 1), "vitaminK" to NutrientDef("µg", 0), "vitaminB1" to NutrientDef("mg", 2),
    "vitaminB2" to NutrientDef("mg", 2), "vitaminB3" to NutrientDef("mg", 1), "vitaminB5" to NutrientDef("mg", 1),
    "vitaminB6" to NutrientDef("mg", 2), "vitaminB7" to NutrientDef("µg", 1), "vitaminB9" to NutrientDef("µg", 0),
    "vitaminB12" to NutrientDef("µg", 1),
)

/** hasEstimatedMacros: one of kcal/protein/carbs/fat came from ESTIMATED or AI. */
fun hasEstimatedMacros(nutrientSources: kotlinx.serialization.json.JsonElement?): Boolean {
    val sources = nutrientSources as? JsonObject ?: return false
    return listOf("kcal", "protein", "carbs", "fat").any {
        val v = (sources[it] as? JsonPrimitive)?.contentOrNull
        v == "ESTIMATED" || v == "AI"
    }
}

fun isAlternativeServingConfident(serving: AlternativeServing) = serving.kcal != null && serving.confidence >= 0.7

/** src/lib/image-tags.ts selectRawContextImageUrl */
fun selectRawContextImageUrl(defaultUrl: String?, images: List<TaggedImage>): String? =
    images.firstOrNull { "Raw" in it.tags }?.url ?: defaultUrl

// ---------------------------------------------------------------------------
// src/lib/registration-report-points.ts

data class ReportPoint(val key: String, val labelKey: String, val value: String, val imageUrl: String? = null, val category: String? = null)

fun reportPointsFor(product: ProductDto): List<ReportPoint> {
    fun r(n: Double?) = if (n == null) "–" else jsNumberText(round1(n))
    val points = mutableListOf(
        ReportPoint("image", "registrationReportError.point.image", "", product.imageUrl, "PRODUCT_IMAGE"),
        ReportPoint("name", "registrationReportError.point.name", product.name),
        ReportPoint("brand", "registrationReportError.point.brand", product.brand?.name ?: ""),
    )
    if (product.barcodes.isNotEmpty()) {
        points += ReportPoint("ean", "registrationReportError.point.ean", product.barcodes.joinToString(", ") { it.code }, category = "EAN")
    }
    points += ReportPoint("energy", "registrationReportError.point.energy", "${jsRound(product.kcalPer100g)} kcal / 100 g", category = "ENERGY")
    points += ReportPoint(
        "macros", "registrationReportError.point.macros",
        "P ${r(product.proteinPer100g)} g · K ${r(product.carbsPer100g)} g · F ${r(product.fatPer100g)} g", category = "ENERGY",
    )
    points += ReportPoint("ingredients", "registrationReportError.point.ingredients", product.ingredientsText ?: "", category = "CONTENT")
    return points
}

fun buildReportDescription(items: List<Pair<String, String>>): String = items.joinToString("\n") { "${it.first}: ${it.second.trim()}" }

// ---------------------------------------------------------------------------
// src/lib/food-latin.ts — non-Danish ingredient words linked to "Mad på latin".

data class FoodTermPart(val text: String, val term: String? = null)

private val FOOD_TERM_NAMES: List<String> by lazy { FoodReferenceData.foodTermLookup.keys.sortedByDescending { it.length } }

fun splitFoodTerms(text: String): List<FoodTermPart> {
    val parts = mutableListOf<FoodTermPart>()
    var last = 0
    var i = 0
    while (i < text.length) {
        if (i > 0 && text[i - 1].isLetterOrDigit()) {
            i++
            continue
        }
        val name = FOOD_TERM_NAMES.firstOrNull { n ->
            text.regionMatches(i, n, 0, n.length, ignoreCase = true) &&
                (i + n.length >= text.length || !text[i + n.length].isLetterOrDigit())
        }
        if (name == null) {
            i++
            continue
        }
        if (i > last) parts += FoodTermPart(text.substring(last, i))
        val matched = text.substring(i, i + name.length)
        parts += FoodTermPart(matched, FoodReferenceData.foodTermLookup[name])
        i += name.length
        last = i
    }
    if (last < text.length) parts += FoodTermPart(text.substring(last))
    return parts
}

fun foodTermHref(term: String): String {
    val anchor = term.lowercase().replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
        .replace(Regex("[^a-z0-9]+"), "-").trim('-')
    return "/viden-om/mad-paa-latin/$anchor"
}

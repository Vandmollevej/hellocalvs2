package dk.packroff.hellocal.screens.food

// src/lib/quantity-text.ts + src/lib/product-photo-fit.ts (bruger 2026-10-17).

private val QTY_UNITS = mapOf(
    "kg" to "kg", "kilo" to "kg", "g" to "g", "gr" to "g", "gr." to "g", "gram" to "g", "mg" to "mg",
    "l" to "l", "ltr" to "l", "liter" to "l", "litre" to "l", "dl" to "dl", "cl" to "cl", "ml" to "ml",
    "stk" to "stk", "pcs" to "stk", "pc" to "stk", "stk." to "stk",
)
private const val QTY_UNIT = "(kg|kilo|g|gr\\.?|gram|mg|ml|cl|dl|l|ltr|liter|litre|stk\\.?|pcs|pc)"
private const val QTY_NUM = "(\\d+(?:[.,]\\d+)?)"
private val QTY_MULTI = Regex("^(\\d+)\\s*[x×]\\s*$QTY_NUM\\s*$QTY_UNIT$", RegexOption.IGNORE_CASE)
private val QTY_SINGLE = Regex("^(ca\\.?\\s*)?$QTY_NUM\\s*$QTY_UNIT$", RegexOption.IGNORE_CASE)

private fun qtyNum(n: String): String {
    val v = kotlin.math.round(n.replace(",", ".").toDouble() * 1000) / 1000
    return if (v == kotlin.math.floor(v)) v.toLong().toString() else v.toString()
}

/** "1l" → "1 l", "500ML" → "500 ml", "6x33cl" → "6 x 33 cl". Andet returneres trimmet. */
fun formatQuantityText(text: String?): String? {
    val raw = text?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val t = raw.removeSuffix(".").trim()
    QTY_MULTI.find(t)?.let { m -> return "${m.groupValues[1]} x ${qtyNum(m.groupValues[2])} ${QTY_UNITS[m.groupValues[3].lowercase()]}" }
    QTY_SINGLE.find(t)?.let { m ->
        val ca = if (m.groupValues[1].isNotEmpty()) "ca. " else ""
        return "$ca${qtyNum(m.groupValues[2])} ${QTY_UNITS[m.groupValues[3].lowercase()]}"
    }
    return raw
}

/** Højt/bredt råfoto (> 25 % skævt) vises helt i cirklen i stedet for at blive zoomet ind. */
fun rawPhotoShouldContain(width: Int, height: Int): Boolean {
    if (width <= 0 || height <= 0) return false
    val ratio = if (width >= height) width.toDouble() / height else height.toDouble() / width
    return ratio > 1.25
}

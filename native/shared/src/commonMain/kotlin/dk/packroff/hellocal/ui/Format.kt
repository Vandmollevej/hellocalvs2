package dk.packroff.hellocal.ui

import dk.packroff.hellocal.i18n.Locale
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.roundToLong

/**
 * Number formatting like the web's Intl.NumberFormat for the app locales
 * (da/de/nl/no/sv/fr use decimal comma, en uses decimal point).
 */
fun formatNumber(value: Double, decimals: Int = 0, locale: Locale = Locale.Default, minDecimals: Int = decimals): String {
    val (group, decimal) = when (locale) {
        Locale.En -> "," to "."
        Locale.Fr, Locale.Sv, Locale.No -> " " to ","
        else -> "." to ","
    }
    val factor = 10.0.pow(decimals)
    val rounded = (abs(value) * factor).roundToLong()
    val intPart = rounded / factor.toLong()
    var frac = if (decimals > 0) (rounded % factor.toLong()).toString().padStart(decimals, '0') else ""
    while (frac.length > minDecimals && frac.endsWith('0')) frac = frac.dropLast(1)
    val intText = intPart.toString().reversed().chunked(3).joinToString(group).reversed()
    val sign = if (value < 0 && rounded != 0L) "-" else ""
    return sign + intText + if (frac.isNotEmpty()) decimal + frac else ""
}

fun formatNumber(value: Int, locale: Locale = Locale.Default): String = formatNumber(value.toDouble(), 0, locale)

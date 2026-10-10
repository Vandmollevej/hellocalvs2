package dk.packroff.hellocal.ui

import androidx.compose.runtime.Composable

// Decimaltegn i varetekster (src/lib/decimal-separator.ts, docs/REGLER.md 2026-10-10):
// arkene skriver decimaler med punktum ("1.5 l"), brugeren ser landets eget
// decimaltegn — komma i Danmark og de andre komma-lande, punktum i fx GB/US.
// Kun tal med ét decimaltegn omskrives ("3,6,9" og "10.10.2026" røres ikke).

/** Lande hvor punktum er decimaltegn; alle andre bruger komma (som web-listen). */
private val DOT_REGIONS = setOf(
    "US", "CA", "GB", "IE", "AU", "NZ", "CH", "LI", "MX", "JP", "CN", "HK", "TW", "KR", "IN", "PK", "BD",
    "LK", "NP", "SG", "MY", "PH", "TH", "IL", "SA", "AE", "QA", "KW", "BH", "OM", "JO", "EG", "NG",
    "GH", "KE", "UG", "TZ", "ZW", "BW", "MT", "PR", "DO", "GT", "HN", "SV", "NI", "PA", "PE",
)

/** Decimaltegnet i et land (ISO 3166-1 alpha-2). Ukendt land = Danmark = komma. */
fun decimalSeparatorForRegion(region: String?): Char {
    val code = (region ?: "").trim().uppercase()
    return if (code in DOT_REGIONS) '.' else ','
}

private val DOT_DECIMAL = Regex("""(?<![\d.,])(\d+)\.(\d+)(?![\d.,])""")
private val COMMA_DECIMAL = Regex("""(?<![\d.,])(\d+),(\d+)(?![\d.,])""")
// Gammelt dansk tusindtalspunktum ("1.080 g") bliver stående i komma-lande.
private val DANISH_THOUSANDS = Regex("""^[1-9]\d{0,2}\.\d{3}\s?(?:g|mg|ml|gram)\b""", RegexOption.IGNORE_CASE)
private val HAS_DECIMAL = Regex("""\d[.,]\d""")

/** Skriver decimaltal i en varetekst med det givne decimaltegn (localizeDecimals). */
fun localizeDecimals(text: String, separator: Char): String {
    if (text.isEmpty() || !HAS_DECIMAL.containsMatchIn(text)) return text
    if (separator == '.') return COMMA_DECIMAL.replace(text) { "${it.groupValues[1]}.${it.groupValues[2]}" }
    return DOT_DECIMAL.replace(text) { match ->
        if (DANISH_THOUSANDS.containsMatchIn(text.substring(match.range.first))) match.value
        else "${match.groupValues[1]},${match.groupValues[2]}"
    }
}

/** Varetekst med brugerens decimaltegn (web: useLocalizeDecimals / DecimalText). */
@Composable
fun localizedDecimals(text: String): String = localizeDecimals(text, decimalSeparatorForRegion(Units.region()))

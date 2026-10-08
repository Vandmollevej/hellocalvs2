package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon

/*
 * /e-numre and /e-numre/[code].
 *
 * The web renders both from the server-only catalogue src/data/e-numbers.json
 * (~1.25 MB: category, EU status, origin, flags, long description, uses,
 * variants, EFSA opinion, fact-check sources). The only API is GET
 * /api/additives, which carries code, Danish/international name, summary
 * (as "function"), health text (as "risks"), EFSA link and variant rows.
 * The native screens show everything that API gives.
 * TODO(parity): needs category/euStatus/origin/flags/description/uses/variants/efsa
 * in /api/additives (or a GET /api/additives/[code]) for the status filter,
 * "Forbudt i EU" labels, chips and the long sections.
 */

// Number ranges from the EU classification (ENumberDirectory.tsx RANGES).
private val E_RANGES = listOf(
    Triple("Farvestoffer (E100–E199)", 100, 199),
    Triple("Konserveringsmidler (E200–E299)", 200, 299),
    Triple("Antioxidanter og surhedsregulerende midler (E300–E399)", 300, 399),
    Triple("Fortykningsmidler, stabilisatorer og emulgatorer (E400–E499)", 400, 499),
    Triple("Surhedsregulerende og antiklumpningsmidler (E500–E599)", 500, 599),
    Triple("Smagsforstærkere (E600–E699)", 600, 699),
    Triple("Antibiotika (E700–E799)", 700, 799),
    Triple("Overfladebehandling, gasser og sødestoffer (E900–E999)", 800, 999),
    Triple("Øvrige stoffer (E1000+)", 1000, 99999),
)

private val VARIANT_CODE = Regex("^E\\d{3,4}[A-H]?([IVX]+)$")

private fun numericPart(code: String) = code.filter { it.isDigit() }.toIntOrNull() ?: 0

/** A catalogue entry with the variant rows the API lists separately (E331I, E331II …). */
internal data class ENumberGroup(val entry: AdditiveInfo, val variants: List<AdditiveInfo>)

/** Splits /api/additives rows into catalogue entries and their variants (variants were upper-cased by the API). */
internal fun groupAdditives(all: List<AdditiveInfo>): List<ENumberGroup> {
    val byUpper = all.associateBy { it.eNumber.uppercase() }
    fun parentOf(row: AdditiveInfo): AdditiveInfo? {
        val match = VARIANT_CODE.find(row.eNumber) ?: return null
        val base = row.eNumber.dropLast(match.groupValues[1].length)
        return byUpper[base]?.takeIf { it !== row }
    }
    val variants = all.mapNotNull { row -> parentOf(row)?.let { it.eNumber.uppercase() to row } }.groupBy({ it.first }, { it.second })
    return all.filter { parentOf(it) == null }.map { ENumberGroup(it, variants[it.eNumber.uppercase()].orEmpty()) }
}

/** canonicalENumber(): "e331iii", "E 331(iii)", "en:e331" → "E331(iii)" / "E331". */
internal fun canonicalENumber(raw: String): String {
    val value = Location.decode(raw).trim().replace(Regex("^en:", RegexOption.IGNORE_CASE), "").replace(Regex("[\\s-]"), "")
    val match = Regex("^e?(\\d{3,4})([a-h]?)\\(?([ivx]*)\\)?$", RegexOption.IGNORE_CASE).find(value) ?: return value.uppercase()
    val (digits, letter, roman) = match.destructured
    val base = "E$digits${letter.lowercase()}"
    return if (roman.isNotEmpty()) "$base(${roman.lowercase()})" else base
}

// --- /e-numre ---------------------------------------------------------------

/** Native port of src/app/e-numre/page.tsx + ENumberDirectory.tsx. `?code=E330` (old #e330 links) opens the detail page. */
@Composable
fun ENumberDirectoryScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    var query by remember { mutableStateOf("") }
    var groups by remember { mutableStateOf<List<ENumberGroup>?>(null) }

    LaunchedEffect(Unit) {
        // Old links (/e-numre#e330) go to the number's own page.
        args.opt("code")?.takeIf { it.isNotBlank() }?.let {
            nav.replace("/e-numre/" + Location.encode(it.uppercase()))
            return@LaunchedEffect
        }
        groups = runCatching { groupAdditives(Additives.list()) }.getOrDefault(emptyList())
    }

    val all = groups
    val visible = remember(all, query) {
        val q = query.trim().lowercase()
        val compact = q.filter { it.isLetterOrDigit() }.removePrefix("e")
        all.orEmpty().filter { group ->
            if (q.isEmpty()) return@filter true
            val code = group.entry.eNumber.lowercase().removePrefix("e")
            if (compact.isNotEmpty() && code.startsWith(compact)) return@filter true
            val variantsText = group.variants.joinToString(" ") { "${it.eNumber} ${it.danishName} ${it.internationalName}" }
            listOf(group.entry.danishName, group.entry.internationalName, group.entry.function, variantsText).any { it.lowercase().contains(q) }
        }
    }
    val sections = E_RANGES.map { (label, from, to) -> label to visible.filter { numericPart(it.entry.eNumber) in from..to } }
        .filter { it.second.isNotEmpty() }

    Column(Modifier.fillMaxSize().background(HcColors.White)) {
        DirectoryHeader("E-numre", query, { query = it }, "Søg på E-nummer, navn eller funktion", trailing = "${visible.size} stoffer")
        if (all == null) {
            HcLoader()
        } else LazyColumn(
            Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (sections.isEmpty()) {
                item(key = "empty") { HcText("Ingen E-numre matcher din søgning.", HcTypeRoles.Body, color = HcColors.TextSecondary) }
            }
            for ((label, rangeItems) in sections) {
                item(key = "h-$label") { SmallCapsLabel(label, Modifier.padding(top = 12.dp)) }
                items(rangeItems, key = { it.entry.eNumber }) { group ->
                    val item = group.entry
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan)
                            .clickable { nav.push("/e-numre/" + Location.encode(item.eNumber)) }.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        HcText(item.eNumber, HcTypeRoles.Body, Modifier.width(64.dp), bold = true)
                        Column(Modifier.weight(1f)) {
                            HcText(item.danishName.ifEmpty { item.internationalName }, HcTypeRoles.Body)
                            if (item.function.isNotEmpty()) HcText(item.function, HcTypeRoles.Small, color = HcColors.TextSecondary, maxLines = 2)
                        }
                        HcIcon("ChevronRight", size = 18.dp, color = HcColors.TextSecondary)
                    }
                }
            }
            item(key = "note") {
                HcText(
                    "Generel baggrundsinformation baseret på EFSA, JECFA og fagfællebedømt forskning — ikke personlig kostrådgivning.",
                    HcTypeRoles.Small,
                    Modifier.padding(top = 12.dp),
                    color = HcColors.TextSecondary,
                )
            }
        }
    }
}

// --- /e-numre/[code] ------------------------------------------------------

private data class ResearchLink(val label: String, val description: String, val url: String)

/** eNumberResearchLinks() — links scoped to this exact substance (no pubmedTerm/keyReferences from the API). */
private fun researchLinks(code: String, nameEn: String, efsaUrl: String): List<ResearchLink> {
    val term = "\"$nameEn\""
    val codeTerm = code.replaceFirst("E", "E ")
    val pubmedQuery = "($term) AND (food additive OR toxicity OR safety OR health)"
    return buildList {
        if (efsaUrl.isNotEmpty()) add(ResearchLink("EFSA", "EFSA's videnskabelige udtalelse om netop dette stof", efsaUrl))
        add(ResearchLink("PubMed: $nameEn", "Fagfællebedømte studier om stoffets sikkerhed og sundhedseffekter", "https://pubmed.ncbi.nlm.nih.gov/?term=${Location.encode(pubmedQuery)}&sort=date"))
        add(
            ResearchLink(
                "PubMed-oversigtsartikler: $nameEn",
                "Kun reviews og metaanalyser — det samlede overblik over forskningen",
                "https://pubmed.ncbi.nlm.nih.gov/?term=${Location.encode(term)}&filter=pubt.review&filter=pubt.meta-analysis",
            ),
        )
        add(
            ResearchLink(
                "EFSA Journal: $code",
                "Alle EFSA-udtalelser, der nævner dette E-nummer",
                "https://efsa.onlinelibrary.wiley.com/action/doSearch?AllField=${Location.encode("\"$codeTerm\" $nameEn")}",
            ),
        )
        add(
            ResearchLink(
                "WHO/JECFA: $nameEn",
                "FAO/WHO's ekspertkomités toksikologiske vurdering og ADI",
                "https://apps.who.int/food-additives-contaminants-jecfa-database/search?q=${Location.encode(nameEn)}",
            ),
        )
        add(ResearchLink("Europe PMC: $nameEn", "Europæisk forskningsdatabase inkl. fuldtekst-artikler", "https://europepmc.org/search?query=${Location.encode(term)}"))
        add(ResearchLink("Open Food Facts: $code", "Hvilke produkter stoffet findes i", "https://world.openfoodfacts.org/facets/additives/${code.lowercase()}"))
    }
}

/** Native port of src/app/e-numre/[code]/page.tsx (detail page for one E-number). */
@Composable
fun ENumberDetailScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    val requested = canonicalENumber(args["code"])
    val base = requested.replace(Regex("\\(.*\\)$"), "")
    var loaded by remember(requested) { mutableStateOf(false) }
    var group by remember(requested) { mutableStateOf<ENumberGroup?>(null) }

    LaunchedEffect(requested) {
        group = runCatching { groupAdditives(Additives.list()).firstOrNull { it.entry.eNumber.uppercase() == base.uppercase() } }.getOrNull()
        loaded = true
    }

    val entry = group?.entry
    HcScreen(title = entry?.eNumber ?: base, contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when {
                !loaded -> HcLoader()
                entry == null -> KnowledgeSection("Ikke i opslagsværket") {
                    HcText(
                        "$base er ikke et E-nummer, vi kender. Tjek stavningen på varen — eller søg på listen over alle E-numre.",
                        HcTypeRoles.Body,
                        color = HcColors.Black,
                    )
                }
                else -> {
                    val romanCode = requested.substringAfter('(', "").removeSuffix(")")
                    val variant = if (romanCode.isNotEmpty()) group?.variants?.firstOrNull { it.eNumber.uppercase() == (base + romanCode).uppercase() } else null
                    KnowledgeSection("Navn") {
                        HcText(entry.danishName.ifEmpty { entry.internationalName }, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                        if (entry.internationalName.isNotEmpty() && entry.internationalName != entry.danishName) {
                            HcText(entry.internationalName, HcTypeRoles.Body, color = HcColors.TextSecondary)
                        }
                        if (variant != null) {
                            HcText(
                                "Du kom fra $requested: ${variant.danishName.ifEmpty { variant.internationalName }}",
                                HcTypeRoles.Small,
                                color = HcColors.TextSecondary,
                            )
                        }
                        if (entry.function.isNotEmpty()) HcText(entry.function, HcTypeRoles.Body, Modifier.padding(top = 8.dp), color = HcColors.Black)
                    }
                    val variants = group?.variants.orEmpty()
                    if (variants.isNotEmpty()) {
                        KnowledgeSection("Varianter") {
                            for (item in variants) {
                                val isRequested = variant != null && item.eNumber == variant.eNumber
                                HcText("${item.eNumber} — ${item.danishName.ifEmpty { item.internationalName }}", HcTypeRoles.Body, bold = isRequested, color = HcColors.Black)
                            }
                        }
                    }
                    if (entry.risks.isNotEmpty()) KnowledgeSection("Sundhed og risici") { HcText(entry.risks, HcTypeRoles.Body, color = HcColors.Black) }
                    if (entry.research.isNotEmpty()) KnowledgeSection("Forskningen") { HcText(entry.research, HcTypeRoles.Body, color = HcColors.Black) }
                    KnowledgeSection("Forskning og kilder om ${entry.eNumber}") {
                        for (link in researchLinks(entry.eNumber, entry.internationalName.ifEmpty { entry.danishName }, entry.link)) {
                            Column {
                                Row(
                                    Modifier.clickable { NativeHooks.openExternalUrl(link.url) },
                                    verticalAlignment = Alignment.Top,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    HcText(link.label, HcTypeRoles.Body, Modifier.weight(1f, fill = false), color = HcColors.Green, underline = true)
                                    HcIcon("ExternalLink", Modifier.padding(top = 4.dp), size = 14.dp, color = HcColors.Green)
                                }
                                HcText(link.description, HcTypeRoles.Small, color = HcColors.TextSecondary)
                            }
                        }
                    }
                }
            }
            HcText(
                "Se alle E-numre",
                HcTypeRoles.Small,
                Modifier.clickable { nav.backTo("/e-numre") },
                color = HcColors.Green,
                underline = true,
            )
            HcText(
                "Generel baggrundsinformation baseret på EFSA, JECFA og fagfællebedømt forskning — ikke personlig kostrådgivning.",
                HcTypeRoles.Small,
                color = HcColors.TextSecondary,
            )
        }
    }
}

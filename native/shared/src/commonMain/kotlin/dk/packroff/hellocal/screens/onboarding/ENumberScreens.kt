package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject

/*
 * /e-numre and /e-numre/[code].
 *
 * The web renders both from the server-only catalogue src/data/e-numbers.json.
 * Native gets the same data from:
 *  - GET /api/additives — list rows incl. category, euStatus and variantOf
 *    (the fields the web list uses for its EU-status filter and labels);
 *  - GET /api/additives/[code] — the full catalogue entry the detail page shows,
 *    plus the Danish labels (EU_STATUS_LABEL/ORIGIN_LABEL/FLAG_LABEL) and the
 *    research links (eNumberResearchLinks) computed by src/lib/e-number-catalog.ts.
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

/** canonicalENumber(): "e331iii", "E 331(iii)", "en:e331" → "E331(iii)" / "E331". */
internal fun canonicalENumber(raw: String): String {
    val value = Location.decode(raw).trim().replace(Regex("^en:", RegexOption.IGNORE_CASE), "").replace(Regex("[\\s-]"), "")
    val match = Regex("^e?(\\d{3,4})([a-h]?)\\(?([ivx]*)\\)?$", RegexOption.IGNORE_CASE).find(value) ?: return value.uppercase()
    val (digits, letter, roman) = match.destructured
    val base = "E$digits${letter.lowercase()}"
    return if (roman.isNotEmpty()) "$base(${roman.lowercase()})" else base
}

// --- /e-numre ---------------------------------------------------------------

/** One GET /api/additives row with the catalogue fields the /e-numre list uses. */
@Serializable
internal data class ENumberRow(
    val eNumber: String = "",
    val internationalName: String = "",
    val danishName: String = "",
    val function: String = "",
    val category: String = "",
    // "approved" | "banned" | "not_approved"; null for rows only in the database table.
    val euStatus: String? = null,
    // Catalogue code a variant row (E331III) belongs to; null for the entry itself.
    val variantOf: String? = null,
)

/** The rows fetched once and cached (the list is ~480 rows incl. variants). */
private object ENumberRows {
    private val mutex = Mutex()
    private var cache: List<ENumberRow>? = null

    suspend fun list(): List<ENumberRow> = mutex.withLock {
        cache ?: (Api.get("/api/additives").jsonObject["additives"] as? JsonArray).orEmpty()
            .map { ApiJson.decodeFromJsonElement(ENumberRow.serializer(), it) }
            .also { cache = it }
    }
}

/** DirectoryItem in src/app/e-numre/ENumberDirectory.tsx (built by src/app/e-numre/page.tsx). */
internal data class ENumberDirectoryItem(
    val code: String,
    val nameDa: String,
    val nameEn: String,
    val category: String,
    val summary: String,
    val euStatus: String,
    val variants: String,
)

/** Catalogue entries only (like listENumbers()), each with its variants as one search text. */
internal fun directoryItems(rows: List<ENumberRow>): List<ENumberDirectoryItem> {
    // A server without the catalogue fields: group variants by their code and show every row.
    val hasCatalogFields = rows.any { it.euStatus != null }
    val byUpper = rows.associateBy { it.eNumber.uppercase() }
    fun parentOf(row: ENumberRow): String? {
        row.variantOf?.let { return it.uppercase() }
        if (hasCatalogFields) return null
        val code = row.eNumber.uppercase()
        val match = VARIANT_CODE.find(code) ?: return null
        return code.dropLast(match.groupValues[1].length).takeIf { it != code && it in byUpper }
    }
    val variants = rows.mapNotNull { row -> parentOf(row)?.let { it to row } }.groupBy({ it.first }, { it.second })
    return rows.filter { parentOf(it) == null && (!hasCatalogFields || it.euStatus != null) }.map { row ->
        ENumberDirectoryItem(
            code = row.eNumber,
            nameDa = row.danishName,
            nameEn = row.internationalName,
            category = row.category,
            summary = row.function,
            euStatus = row.euStatus ?: "approved",
            variants = variants[row.eNumber.uppercase()].orEmpty()
                .joinToString(" ") { "${canonicalENumber(it.eNumber)} ${it.danishName} ${it.internationalName}" },
        )
    }
}

private val STATUS_FILTERS = listOf("all" to "Alle", "approved" to "Godkendt i EU", "other" to "Forbudt/ikke godkendt")

/** Native port of src/app/e-numre/page.tsx + ENumberDirectory.tsx. `?code=E330` (old #e330 links) opens the detail page. */
@Composable
fun ENumberDirectoryScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    var query by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("all") }
    var items by remember { mutableStateOf<List<ENumberDirectoryItem>?>(null) }

    LaunchedEffect(Unit) {
        // Old links (/e-numre#e330) go to the number's own page.
        args.opt("code")?.takeIf { it.isNotBlank() }?.let {
            nav.replace("/e-numre/" + Location.encode(it.uppercase()))
            return@LaunchedEffect
        }
        items = try {
            directoryItems(ENumberRows.list())
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            emptyList()
        }
    }

    val all = items
    val visible = remember(all, query, status) {
        val q = query.trim().lowercase()
        val compact = q.replace(Regex("[^a-z0-9]"), "").removePrefix("e")
        all.orEmpty().filter { item ->
            if (status == "approved" && item.euStatus != "approved") return@filter false
            if (status == "other" && item.euStatus == "approved") return@filter false
            if (q.isEmpty()) return@filter true
            val code = item.code.lowercase().removePrefix("e")
            if (compact.isNotEmpty() && code.startsWith(compact)) return@filter true
            listOf(item.nameDa, item.nameEn, item.category, item.variants).any { it.lowercase().contains(q) }
        }
    }
    val sections = E_RANGES.map { (label, from, to) -> label to visible.filter { numericPart(it.code) in from..to } }
        .filter { it.second.isNotEmpty() }

    Column(Modifier.fillMaxSize().background(HcColors.White)) {
        DirectoryHeader(
            "E-numre",
            query,
            { query = it },
            "Søg på E-nummer, navn eller funktion",
            trailing = "${visible.size} stoffer",
            below = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((value, label) in STATUS_FILTERS) {
                        val selected = status == value
                        HcText(
                            label,
                            HcTypeRoles.Small,
                            Modifier.clip(CircleShape)
                                .background(if (selected) HcColors.Green else HcColors.Tan)
                                .clickable { status = value }
                                .padding(horizontal = 12.dp, vertical = 4.dp),
                            color = if (selected) HcColors.White else HcColors.Black,
                        )
                    }
                }
            },
        )
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
                items(rangeItems, key = { it.code }) { item ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan)
                            .clickable { nav.push("/e-numre/" + Location.encode(item.code)) }.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        HcText(item.code, HcTypeRoles.Body, Modifier.width(64.dp), bold = true)
                        Column(Modifier.weight(1f)) {
                            HcText(item.nameDa.ifEmpty { item.nameEn }, HcTypeRoles.Body)
                            DirectorySubline(item)
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

/** "Forbudt i EU · " (bold red) + category + " — summary", clamped to two lines. */
@Composable
private fun DirectorySubline(item: ENumberDirectoryItem) {
    val text = buildAnnotatedString {
        if (item.euStatus != "approved") {
            withStyle(SpanStyle(color = HcColors.RedDark, fontWeight = FontWeight.Bold)) {
                append(if (item.euStatus == "banned") "Forbudt i EU · " else "Ikke godkendt i EU · ")
            }
        }
        append(item.category)
        if (item.summary.isNotEmpty()) append(" — ${item.summary}")
    }
    if (text.isNotEmpty()) {
        Text(text, style = HcTypeRoles.Small.style(HcColors.TextSecondary), maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

// --- /e-numre/[code] ------------------------------------------------------

@Serializable
internal data class ENumberVariantDto(val code: String = "", val nameDa: String = "", val nameEn: String = "")

@Serializable
internal data class ENumberEfsaDto(
    val title: String = "",
    val url: String = "",
    val date: String = "",
    val adi: String = "",
    val overexposureRisk: String = "",
)

@Serializable
internal data class ENumberVerificationDto(val status: String = "", val sources: List<String> = emptyList(), val notes: String = "")

/** ENumberEntry in src/lib/e-number-catalog.ts (the fields the detail page shows). */
@Serializable
internal data class ENumberEntryDto(
    val code: String = "",
    val nameDa: String = "",
    val nameEn: String = "",
    val category: String = "",
    val euStatus: String = "approved",
    val origin: String = "",
    val summary: String = "",
    val description: String = "",
    val uses: String = "",
    val health: String = "",
    val research: String = "",
    val flags: List<String> = emptyList(),
    val variants: List<ENumberVariantDto> = emptyList(),
    val efsa: ENumberEfsaDto? = null,
    val verification: ENumberVerificationDto? = null,
)

@Serializable
internal data class ENumberLabelsDto(val euStatus: String = "", val origin: String = "", val flags: List<String> = emptyList())

@Serializable
internal data class ENumberResearchLinkDto(val label: String = "", val description: String = "", val url: String = "")

/** The "additives" table row for codes outside the catalogue (the page's Fallback). */
@Serializable
internal data class ENumberFallbackDto(
    val eNumber: String = "",
    val internationalName: String = "",
    val danishName: String = "",
    val function: String = "",
    val risks: String = "",
    val research: String = "",
)

/** GET /api/additives/[code]. */
@Serializable
internal data class ENumberDetailDto(
    val requested: String = "",
    val title: String = "",
    val entry: ENumberEntryDto? = null,
    val variant: ENumberVariantDto? = null,
    val labels: ENumberLabelsDto? = null,
    val researchLinks: List<ENumberResearchLinkDto> = emptyList(),
    val fallback: ENumberFallbackDto? = null,
)

/** overexposureLabel() in src/app/e-numre/[code]/page.tsx. */
private fun overexposureLabel(value: String): String = when (val risk = value.removePrefix("en:")) {
    "high" -> "høj"
    "moderate" -> "moderat"
    "no" -> "ingen"
    else -> risk
}

private enum class ChipTone { Neutral, Warn, Ok }

/** Chip in src/app/e-numre/[code]/page.tsx (hf-type-small rounded-full px-3 py-1). */
@Composable
private fun ENumberChip(text: String, tone: ChipTone = ChipTone.Neutral) {
    val background = when (tone) {
        ChipTone.Warn -> HcColors.RedMuted.copy(alpha = 0.25f)
        ChipTone.Ok -> HcColors.Green.copy(alpha = 0.15f)
        ChipTone.Neutral -> HcColors.White
    }
    HcText(
        text,
        HcTypeRoles.Small,
        Modifier.clip(CircleShape).background(background).padding(horizontal = 12.dp, vertical = 4.dp),
        color = HcColors.Black,
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ENumberChips(content: @Composable () -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
}

@Composable
private fun BodyText(text: String, bold: Boolean = false) = HcText(text, HcTypeRoles.Body, color = HcColors.Black, bold = bold)

/** <a className="text-hf-green underline"> opening an external page. */
@Composable
private fun ExternalLink(label: String, url: String, small: Boolean = false, icon: Boolean = true) {
    Row(
        Modifier.clickable { NativeHooks.openExternalUrl(url) },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        HcText(label, if (small) HcTypeRoles.Small else HcTypeRoles.Body, Modifier.weight(1f, fill = false), color = HcColors.Green, underline = true)
        if (icon) HcIcon("ExternalLink", Modifier.padding(top = 4.dp), size = 14.dp, color = HcColors.Green)
    }
}

/** Native port of src/app/e-numre/[code]/page.tsx (detail page for one E-number). */
@Composable
fun ENumberDetailScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val requested = canonicalENumber(args["code"])
    val base = requested.replace(Regex("\\(.*\\)$"), "")
    var loaded by remember(requested) { mutableStateOf(false) }
    var failed by remember(requested) { mutableStateOf(false) }
    var detail by remember(requested) { mutableStateOf<ENumberDetailDto?>(null) }

    LaunchedEffect(requested) {
        try {
            detail = ApiJson.decodeFromJsonElement(ENumberDetailDto.serializer(), Api.get("/api/additives/" + Location.encode(requested)))
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            failed = true
        }
        loaded = true
    }

    val data = detail
    val title = data?.title?.ifEmpty { null } ?: base
    HcScreen(title = title, contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val entry = data?.entry
            val fallback = data?.fallback
            when {
                !loaded -> HcLoader()
                failed -> HcText(t.t("offline.message"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                entry != null -> EntryView(
                    entry,
                    data?.variant,
                    data?.labels,
                    data?.researchLinks.orEmpty(),
                    data?.requested?.ifEmpty { null } ?: requested,
                )
                fallback != null -> FallbackView(fallback)
                else -> KnowledgeSection("Ikke i opslagsværket") {
                    BodyText("$title er ikke et E-nummer, vi kender. Tjek stavningen på varen — eller søg på listen over alle E-numre.")
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

/** EntryView in src/app/e-numre/[code]/page.tsx. */
@Composable
private fun EntryView(
    entry: ENumberEntryDto,
    variant: ENumberVariantDto?,
    labels: ENumberLabelsDto?,
    links: List<ENumberResearchLinkDto>,
    requested: String,
) {
    KnowledgeSection("Navn") {
        BodyText(entry.nameDa.ifEmpty { entry.nameEn }, bold = true)
        if (entry.nameEn.isNotEmpty() && entry.nameEn != entry.nameDa) {
            HcText(entry.nameEn, HcTypeRoles.Body, color = HcColors.TextSecondary)
        }
        if (variant != null) {
            HcText("Du kom fra ${variant.code}: ${variant.nameDa.ifEmpty { variant.nameEn }}", HcTypeRoles.Small, color = HcColors.TextSecondary)
        }
        Column(Modifier.padding(top = 4.dp)) {
            ENumberChips {
                ENumberChip(labels?.euStatus.orEmpty().ifEmpty { entry.euStatus }, if (entry.euStatus == "approved") ChipTone.Ok else ChipTone.Warn)
                if (entry.category.isNotEmpty()) ENumberChip(entry.category)
                val origin = labels?.origin.orEmpty().ifEmpty { entry.origin }
                if (origin.isNotEmpty()) ENumberChip(origin)
                val adi = entry.efsa?.adi.orEmpty()
                if (adi.isNotEmpty()) ENumberChip("ADI: $adi")
            }
        }
        if (entry.summary.isNotEmpty()) BodyText(entry.summary)
    }

    if (entry.flags.isNotEmpty()) {
        val flagLabels = labels?.flags?.takeIf { it.size == entry.flags.size } ?: entry.flags
        KnowledgeSection("Vær opmærksom hvis") {
            ENumberChips { for (flag in flagLabels) ENumberChip(flag, ChipTone.Warn) }
        }
    }

    if (entry.description.isNotEmpty()) KnowledgeSection("Hvad er det") { BodyText(entry.description) }

    if (entry.variants.isNotEmpty()) {
        KnowledgeSection("Varianter") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for (item in entry.variants) {
                    val text = buildAnnotatedString {
                        append("${item.code} — ${item.nameDa.ifEmpty { item.nameEn }}")
                        if (item.nameEn.isNotEmpty() && item.nameDa.isNotEmpty() && item.nameEn != item.nameDa) {
                            withStyle(SpanStyle(color = HcColors.TextSecondary)) { append(" (${item.nameEn})") }
                        }
                    }
                    val style = HcTypeRoles.Body.style(HcColors.Black)
                    Text(text, style = if (item.code == requested) style.copy(fontWeight = FontWeight.Bold) else style)
                }
            }
        }
    }

    if (entry.uses.isNotEmpty()) KnowledgeSection("Hvor findes det") { BodyText(entry.uses) }
    if (entry.health.isNotEmpty()) KnowledgeSection("Sundhed og risici") { BodyText(entry.health) }
    if (entry.research.isNotEmpty()) KnowledgeSection("Forskningen") { BodyText(entry.research) }

    entry.efsa?.let { efsa ->
        KnowledgeSection("EFSA's vurdering") {
            BodyText(efsa.title)
            val meta = listOfNotNull(
                efsa.date.takeIf { it.isNotEmpty() }?.let { "Offentliggjort $it" },
                efsa.adi.takeIf { it.isNotEmpty() }?.let { "ADI $it" },
                efsa.overexposureRisk.takeIf { it.isNotEmpty() }?.let { "Risiko for overskridelse: ${overexposureLabel(it)}" },
            ).joinToString(" · ")
            if (meta.isNotEmpty()) HcText(meta, HcTypeRoles.Small, color = HcColors.TextSecondary)
        }
    }

    val sources = entry.verification?.sources.orEmpty()
    if (sources.isNotEmpty()) {
        KnowledgeSection("Faktatjekket mod") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for (url in sources) {
                    ExternalLink(url.replace(Regex("^https?://(www\\.)?"), ""), url, small = true, icon = false)
                }
            }
        }
    }

    KnowledgeSection("Forskning og kilder om ${entry.code}") {
        for (link in links) {
            Column {
                ExternalLink(link.label, link.url)
                HcText(link.description, HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
        }
    }
}

/** Fallback in src/app/e-numre/[code]/page.tsx — the database row for codes outside the catalogue. */
@Composable
private fun FallbackView(row: ENumberFallbackDto) {
    KnowledgeSection("Navn") {
        BodyText(row.internationalName, bold = true)
        if (row.danishName.isNotEmpty()) HcText(row.danishName, HcTypeRoles.Body, color = HcColors.TextSecondary)
    }
    if (row.function.isNotEmpty()) KnowledgeSection("Hvad er det") { BodyText(row.function) }
    if (row.risks.isNotEmpty()) KnowledgeSection("Sundhed og risici") { BodyText(row.risks) }
    if (row.research.isNotEmpty()) KnowledgeSection("Forskningen") { BodyText(row.research) }
}

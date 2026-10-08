package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.OnbChevronRows
import dk.packroff.hellocal.ui.OnbRow
import dk.packroff.hellocal.ui.OnbSearchField
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject

// --- src/lib/additives.ts (client side of /api/additives) -------------------

@Serializable
internal data class AdditiveInfo(
    val eNumber: String = "",
    val internationalName: String = "",
    val danishName: String = "",
    val function: String = "",
    val risks: String = "",
    val research: String = "",
    val link: String = "",
    val source: String = "",
)

/** The whole E-number table (~343 rows) fetched once via GET /api/additives and cached. */
internal object Additives {
    private val mutex = Mutex()
    private var cache: List<AdditiveInfo>? = null

    private fun numeric(code: String) = code.filter { it.isDigit() }.toIntOrNull() ?: 0

    /** listAdditives(): all E-numbers sorted by number (E100 before E1100). */
    suspend fun list(): List<AdditiveInfo> = mutex.withLock {
        cache ?: run {
            val rows = (Api.get("/api/additives").jsonObject["additives"] as? JsonArray).orEmpty()
                .map { ApiJson.decodeFromJsonElement(AdditiveInfo.serializer(), it) }
            // Same de-duplication as the web's Map keyed by upper-case code.
            val unique = LinkedHashMap<String, AdditiveInfo>()
            for (row in rows) unique[row.eNumber.uppercase()] = row
            unique.values.sortedWith(compareBy<AdditiveInfo> { numeric(it.eNumber) }.thenBy { it.eNumber }).also { cache = it }
        }
    }

    suspend fun find(code: String): AdditiveInfo? = list().firstOrNull { it.eNumber.uppercase() == code.uppercase() }
}

/** matchesAdditive(): by code ("e330", "330") or by Danish/international name or function. */
internal fun matchesAdditive(additive: AdditiveInfo, query: String): Boolean {
    val q = query.trim().lowercase()
    if (q.isEmpty()) return true
    val code = additive.eNumber.lowercase()
    if (code.contains(q) || code.removePrefix("e").startsWith(q.replace(Regex("^e\\s*"), ""))) return true
    return "${additive.danishName} ${additive.internationalName} ${additive.function}".lowercase().contains(q)
}

internal fun additiveRow(item: AdditiveInfo): OnbRow {
    val name = item.danishName.ifEmpty { item.internationalName }
    return OnbRow(
        key = "e-${item.eNumber}",
        label = item.eNumber.uppercase() + if (name.isNotEmpty()) " · $name" else "",
        href = "/e-numre/" + Location.encode(item.eNumber.uppercase()),
    )
}

// --- src/lib/knowledge-index.ts -------------------------------------------

internal val KNOWLEDGE_SECTIONS = listOf(
    "vitaminer" to "Vitaminer",
    "e-numre" to "E-numre",
    "sundhedstips" to "Sundhedstips",
    "kalorieforbraending" to "Kalorieforbrænding",
    "who-og-kilder" to "WHO og officielle kilder",
    "mad-paa-latin" to "Mad på latin",
)

private val SEARCHABLE_SECTIONS = listOf("vitaminer", "sundhedstips", "kalorieforbraending", "who-og-kilder", "mad-paa-latin")

internal data class KnowledgeEntry(val section: String, val slug: String, val title: String, val subtitle: String)

internal fun sectionTitle(id: String): String? = KNOWLEDGE_SECTIONS.firstOrNull { it.first == id }?.second

internal fun entryHref(section: String, slug: String) = "/viden-om/$section/$slug"

internal fun listEntries(section: String): List<KnowledgeEntry> =
    if (section == "mad-paa-latin") {
        sortedFoodTerms.map { KnowledgeEntry(section, foodTermAnchor(it.term), it.term, it.danish) }
    } else {
        KnowledgeArticles.all.filter { it.category == section }.map { KnowledgeEntry(section, it.slug, it.title, it.summary) }
    }

private fun articleMatches(article: KnowledgeArticle, q: String) =
    (listOf(article.title, article.summary, article.funFact ?: "") + article.body).any { it.lowercase().contains(q) }

internal fun searchEntries(query: String, section: String? = null): List<KnowledgeEntry> {
    val q = query.trim().lowercase()
    val sections = if (section != null) listOf(section) else SEARCHABLE_SECTIONS
    return sections.flatMap { id ->
        listEntries(id).filter { entry ->
            when {
                q.isEmpty() -> true
                id == "mad-paa-latin" -> FoodTerms.all.firstOrNull { foodTermAnchor(it.term) == entry.slug }?.let { matchesFoodTerm(it, q) } == true
                else -> KnowledgeArticles.all.firstOrNull { it.slug == entry.slug }?.let { articleMatches(it, q) } == true
            }
        }
    }
}

/** .hf-page with "flex flex-col gap-3". */
private val KnowledgePadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)

// --- /viden-om ------------------------------------------------------------

/**
 * Native port of src/app/viden-om/page.tsx — "Viden om mad" (opened from the
 * profile page). Searching on the front page covers everything incl. single E-numbers.
 */
@Composable
fun KnowledgeScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val nav = LocalNavigator.current
    var query by remember { mutableStateOf("") }
    var additives by remember { mutableStateOf<List<AdditiveInfo>>(emptyList()) }
    LaunchedEffect(Unit) { additives = runCatching { Additives.list() }.getOrDefault(emptyList()) }

    val q = query.trim()
    val rows = if (q.isNotEmpty()) {
        searchEntries(q).map { OnbRow("${it.section}/${it.slug}", it.title, entryHref(it.section, it.slug)) } +
            (if (q.length >= 2 && "e-numre".startsWith(q.lowercase())) listOf(OnbRow("e-numre", "E-numre", "/viden-om/e-numre")) else emptyList()) +
            additives.filter { matchesAdditive(it, q) }.take(30).map(::additiveRow)
    } else {
        KNOWLEDGE_SECTIONS.map { (id, title) -> OnbRow(id, title, "/viden-om/$id") }
    }

    HcScreen(title = "Viden om mad", contentPadding = KnowledgePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OnbSearchField(query, { query = it }, "Søg i alt: vitaminer, E-numre, forbrænding, WHO og ord")
            OnbChevronRows(rows, icon = "Book", onOpen = { nav.push(it.href) })
        }
    }
}

// --- /viden-om/[category] ---------------------------------------------------

/** Native port of src/app/viden-om/[category]/page.tsx — one knowledge section with its own search. */
@Composable
fun KnowledgeSectionScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    val category = args["category"]
    var query by remember { mutableStateOf("") }
    val title = sectionTitle(category)
    if (title == null || category == "e-numre") {
        NotFoundScreen()
        return
    }
    val rows = searchEntries(query, category).map { OnbRow(it.slug, it.title, entryHref(it.section, it.slug)) }
    HcScreen(title = title, contentPadding = KnowledgePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OnbSearchField(query, { query = it }, "Søg i ${title.lowercase()}")
            OnbChevronRows(rows, icon = "Book", onOpen = { nav.push(it.href) })
        }
    }
}

// --- /viden-om/[category]/[slug] -------------------------------------------

/** Native port of src/app/viden-om/[category]/[slug]/page.tsx — one article or one "Mad på latin" word. */
@Composable
fun KnowledgeEntryScreen(args: RouteArgs) {
    val category = args["category"]
    val slug = args["slug"]

    if (category == "mad-paa-latin") {
        val term = FoodTerms.all.firstOrNull { foodTermAnchor(it.term) == slug }
        if (term == null) {
            NotFoundScreen()
            return
        }
        HcScreen(title = term.term, contentPadding = KnowledgePadding) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                KnowledgeSection("På dansk") { HcText(term.danish, HcTypeRoles.Body, bold = true, color = HcColors.Black) }
                KnowledgeSection("Forklaring") { HcText(term.explanation, HcTypeRoles.Body, color = HcColors.Black) }
                KnowledgeSources(listOf(term.source))
            }
        }
        return
    }

    val article = KnowledgeArticles.all.firstOrNull { it.slug == slug }
    if (article == null || article.category != category) {
        NotFoundScreen()
        return
    }
    HcScreen(title = article.title, contentPadding = KnowledgePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            KnowledgeSection("Kort fortalt") { HcText(article.summary, HcTypeRoles.Body, bold = true, color = HcColors.Black) }
            KnowledgeSection("Forklaring") {
                for (paragraph in article.body) HcText(paragraph, HcTypeRoles.Body, color = HcColors.Black)
            }
            article.funFact?.let { fact -> KnowledgeSection("Fun fact") { HcText(fact, HcTypeRoles.Body, color = HcColors.Black) } }
            KnowledgeSources(listOf(article.source) + article.moreSources)
        }
    }
}

/** Section card: small uppercase grey title, body below (hf-card). */
@Composable
internal fun KnowledgeSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    HcCard {
        SmallCapsLabel(title)
        Column(Modifier.fillMaxWidth().padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun KnowledgeSources(sources: List<OnbSourceLink>) {
    KnowledgeSection(if (sources.size > 1) "Kilder" else "Kilde") {
        for (source in sources) {
            Row(
                Modifier.clickable { NativeHooks.openExternalUrl(source.href) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                HcText(source.label, HcTypeRoles.Body, Modifier.weight(1f, fill = false), color = HcColors.Green, underline = true)
                HcIcon("ExternalLink", size = 14.dp, color = HcColors.Green)
            }
        }
    }
}

/** Next.js notFound() — the default 404 page. */
@Composable
internal fun NotFoundScreen() {
    HcScreen(title = "404") {
        HcText("This page could not be found.", HcTypeRoles.Body, Modifier.fillMaxWidth().padding(top = 32.dp), align = TextAlign.Center)
    }
}

// --- /viden-om/e-numre ----------------------------------------------------

/** Native port of src/app/viden-om/e-numre/page.tsx — E-numbers as a block list opening /e-numre/<code>. */
@Composable
fun KnowledgeENumbersScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val nav = LocalNavigator.current
    var query by remember { mutableStateOf("") }
    var additives by remember { mutableStateOf<List<AdditiveInfo>?>(null) }
    LaunchedEffect(Unit) { additives = runCatching { Additives.list() }.getOrDefault(emptyList()) }

    HcScreen(title = "E-numre", contentPadding = KnowledgePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OnbSearchField(query, { query = it }, "Søg på E-nummer eller navn")
            val list = additives
            if (list == null) {
                HcText("Henter...", HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            } else {
                val rows = list.filter { matchesAdditive(it, query) }.map { additiveRow(it).copy(key = it.eNumber) }
                OnbChevronRows(rows, icon = "Flask", onOpen = { nav.push(it.href) })
            }
        }
    }
}

package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText

/** src/lib/micronutrient-info.ts micronutrientSources(): trustworthy links about the same nutrient. */
internal fun micronutrientSources(info: MicronutrientInfo): List<OnbSourceLink> {
    val term = Location.encode(info.searchTerm)
    return listOf(
        OnbSourceLink("Fødevarestyrelsen (altomkost.dk)", "https://altomkost.dk/soeg/?q=" + Location.encode(info.name)),
        OnbSourceLink("EFSA", "https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values"),
        OnbSourceLink("PubMed", "https://pubmed.ncbi.nlm.nih.gov/?term=$term%20nutrition"),
        OnbSourceLink("Wikipedia", "https://en.wikipedia.org/wiki/Special:Search?search=$term"),
    )
}

private sealed interface MicroRow {
    data class Title(val text: String) : MicroRow
    data class Entry(val info: MicronutrientInfo) : MicroRow
}

/**
 * Native port of src/app/vitaminer/page.tsx + MicronutrientDirectory.tsx: one card
 * per vitamin/mineral. `?key=vitaminc` (the web's #vitaminc anchor) opens at that
 * nutrient and highlights it.
 */
@Composable
fun MicronutrientScreen(args: RouteArgs) {
    var query by remember { mutableStateOf("") }
    val activeAnchor = remember { (args.opt("key") ?: "").lowercase() }
    val listState = rememberLazyListState()

    val visible = remember(query) {
        val q = query.trim().lowercase()
        if (q.isEmpty()) {
            Micronutrients.all
        } else {
            Micronutrients.all.filter { item -> listOf(item.name, item.alsoKnownAs, item.function, item.sources).any { it.lowercase().contains(q) } }
        }
    }
    val rows = remember(visible) {
        buildList {
            for ((title, group) in listOf("Vitaminer" to "vitamin", "Mineraler" to "mineral")) {
                val items = visible.filter { it.group == group }
                if (items.isNotEmpty()) {
                    add(MicroRow.Title(title))
                    items.forEach { add(MicroRow.Entry(it)) }
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        if (activeAnchor.isNotEmpty()) {
            val index = rows.indexOfFirst { it is MicroRow.Entry && it.info.key.lowercase() == activeAnchor }
            if (index >= 0) listState.scrollToItem(index)
        }
    }

    Column(Modifier.fillMaxSize().background(HcColors.White)) {
        DirectoryHeader("Vitaminer og mineraler", query, { query = it }, "Søg på vitamin, mineral eller funktion")
        LazyColumn(
            Modifier.weight(1f).fillMaxWidth(),
            state = listState,
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (visible.isEmpty()) {
                item(key = "empty") { HcText("Ingen vitaminer eller mineraler matcher din søgning.", HcTypeRoles.Body, color = HcColors.TextSecondary) }
            }
            items(rows, key = { row -> if (row is MicroRow.Entry) row.info.key else (row as MicroRow.Title).text }) { row ->
                when (row) {
                    is MicroRow.Title -> HcText(row.text, HcTypeRoles.Title)
                    is MicroRow.Entry -> MicronutrientCard(row.info, active = row.info.key.lowercase() == activeAnchor)
                }
            }
            item(key = "note") {
                HcText(
                    "Generel baggrundsinformation. Referenceindtag er EU's referenceindtag for voksne (samme tal som \"% RI\" på " +
                        "varedeklarationer) — ikke personlig kostrådgivning.",
                    HcTypeRoles.Small,
                    color = HcColors.TextSecondary,
                )
            }
        }
    }
}

@Composable
private fun MicronutrientCard(info: MicronutrientInfo, active: Boolean) {
    DirectoryCard(active) {
        HcText(info.name, HcTypeRoles.Body, bold = true)
        HcText(info.alsoKnownAs, HcTypeRoles.Small, color = HcColors.TextSecondary)
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            MicronutrientFields(info)
        }
    }
}

/** MicronutrientFields: labelled texts + "Troværdige kilder" links. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MicronutrientFields(info: MicronutrientInfo) {
    Field("Funktion", info.function)
    Field("Findes i", info.sources)
    Field("Referenceindtag", info.referenceIntake)
    Field("For lidt eller for meget", info.tooLittleOrMuch)
    Column {
        SmallCapsLabel("Troværdige kilder")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (link in micronutrientSources(info)) {
                HcText(
                    link.label,
                    HcTypeRoles.Small,
                    Modifier.clickable { NativeHooks.openExternalUrl(link.href) },
                    color = HcColors.Green,
                    underline = true,
                )
            }
        }
    }
}

@Composable
private fun Field(label: String, text: String) {
    if (text.isEmpty()) return
    Column(Modifier.fillMaxWidth()) {
        SmallCapsLabel(label)
        HcText(text, HcTypeRoles.Body)
    }
}

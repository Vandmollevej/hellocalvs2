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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.OnbRichText
import kotlinx.coroutines.launch

/** src/lib/food-latin.ts foodTermAnchor(): "Glukose-fruktosesirup" → "glukose-fruktosesirup", æ/ø/å → ae/oe/aa. */
internal fun foodTermAnchor(term: String): String =
    term.lowercase().replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
        .replace(Regex("[^a-z0-9]+"), "-").trim('-')

/** src/lib/food-latin.ts matchesFoodTerm(). */
internal fun matchesFoodTerm(item: FoodTerm, query: String): Boolean {
    val q = query.trim().lowercase()
    if (q.isEmpty()) return true
    return (listOf(item.term, item.danish, item.explanation) + item.aliases).any { it.lowercase().contains(q) }
}

internal val sortedFoodTerms: List<FoodTerm> by lazy { FoodTerms.all.sortedBy { it.term.lowercase() } }

/**
 * Native port of src/app/mad-paa-latin/page.tsx + FoodTermDirectory.tsx: dictionary of
 * non-Danish ingredient names, one card per word. Tapping a word in the index scrolls
 * to its card and highlights it (the web's #anchor). `?term=<anchor>` opens at a word.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FoodLatinScreen(args: RouteArgs) {
    var query by remember { mutableStateOf("") }
    var activeAnchor by remember { mutableStateOf(args.opt("term") ?: "") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val visible = remember(query) { sortedFoodTerms.filter { matchesFoodTerm(it, query) } }
    // Index row + optional empty text come before the cards.
    val headerCount = (if (query.isEmpty()) 1 else 0) + (if (visible.isEmpty()) 1 else 0)

    fun jumpTo(anchor: String) {
        activeAnchor = anchor
        val index = visible.indexOfFirst { foodTermAnchor(it.term) == anchor }
        if (index >= 0) scope.launch { listState.animateScrollToItem(headerCount + index) }
    }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (activeAnchor.isNotEmpty()) {
            val index = visible.indexOfFirst { foodTermAnchor(it.term) == activeAnchor }
            if (index >= 0) listState.scrollToItem(headerCount + index)
        }
    }

    Column(Modifier.fillMaxSize().background(HcColors.White)) {
        DirectoryHeader("Mad på latin", query, { query = it }, "Søg på ingrediens")
        LazyColumn(
            Modifier.weight(1f).fillMaxWidth(),
            state = listState,
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (query.isEmpty()) {
                item(key = "index") {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        for (item in visible) {
                            HcText(item.term, HcTypeRoles.Small, Modifier.clickable { jumpTo(foodTermAnchor(item.term)) }, color = HcColors.Green)
                        }
                    }
                }
            }
            if (visible.isEmpty()) {
                item(key = "empty") { HcText("Ingen ingredienser matcher din søgning.", HcTypeRoles.Body, color = HcColors.TextSecondary) }
            }
            items(visible, key = { it.term }) { item ->
                val anchor = foodTermAnchor(item.term)
                DirectoryCard(active = activeAnchor == anchor) {
                    HcText(item.term, HcTypeRoles.Body, Modifier.clickable { activeAnchor = anchor }, bold = true)
                    HcText("På dansk: ${item.danish}", HcTypeRoles.Small, color = HcColors.TextSecondary)
                    HcText(item.explanation, HcTypeRoles.Body, Modifier.padding(top = 8.dp))
                    OnbRichText(
                        "Kilde: {${item.source.label}|${item.source.href}}",
                        HcTypeRoles.Small,
                        Modifier.padding(top = 8.dp),
                        color = HcColors.TextSecondary,
                        linkColor = HcColors.Green,
                    )
                }
            }
        }
    }
}

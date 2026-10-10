package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcText

/** The extra fields GET /api/products?q= returns when the server corrected or suggests a search. */
data class SearchCorrection(
    val correctedQuery: String? = null,
    val originalQuery: String? = null,
    val suggestedQuery: String? = null,
) {
    fun isActive() = !correctedQuery.isNullOrBlank() || !suggestedQuery.isNullOrBlank()

    companion object {
        fun of(data: ProductListResponse) = SearchCorrection(data.correctedQuery, data.originalQuery, data.suggestedQuery)
    }
}

/** Template with a {query} token → text with the query part in bold. */
private fun withBoldQuery(template: String, query: String): AnnotatedString = buildAnnotatedString {
    val at = template.indexOf("{query}")
    if (at < 0) {
        append(template)
        return@buildAnnotatedString
    }
    append(template.substring(0, at))
    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(query) }
    append(template.substring(at + "{query}".length))
}

/**
 * Native port of src/components/hf/SearchCorrectionNotice.tsx. "Showing results for X" + a tappable
 * "Search instead for Y" when the server corrected the text; a tappable "Did you mean X?" when it
 * only has a suggestion.
 */
@Composable
fun SearchCorrectionNotice(
    correction: SearchCorrection,
    onSearchInstead: (String) -> Unit,
    onUseSuggestion: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val t = LocalTranslator.current
    val corrected = correction.correctedQuery?.takeIf { it.isNotBlank() }
    val original = correction.originalQuery?.takeIf { it.isNotBlank() }
    val suggested = correction.suggestedQuery?.takeIf { it.isNotBlank() }
    if (corrected != null && original != null) {
        Column(modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
            Text(
                withBoldQuery(t.t("searchCorrection.showingFor", "query" to "{query}"), corrected),
                style = HcTypeRoles.Small.style(HcColors.TextSecondary),
            )
            HcText(
                t.t("searchCorrection.searchInstead", "query" to original),
                HcTypeRoles.Small,
                Modifier.clickable { onSearchInstead(original) }.padding(top = 4.dp),
                color = HcColors.TextSecondary,
                underline = true,
            )
        }
    } else if (suggested != null) {
        Text(
            withBoldQuery(t.t("searchCorrection.didYouMean", "query" to "{query}"), suggested),
            modifier.fillMaxWidth().padding(horizontal = 4.dp).clickable { onUseSuggestion(suggested) },
            style = HcTypeRoles.Small.style(HcColors.TextSecondary),
        )
    }
}

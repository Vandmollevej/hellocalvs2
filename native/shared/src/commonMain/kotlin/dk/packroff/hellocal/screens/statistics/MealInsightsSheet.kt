package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcSheetDots
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlin.coroutines.cancellation.CancellationException
import kotlin.math.roundToInt

// src/components/MealInsightsSheet.tsx — "Udregn" on the statistics page
// (docs/DECISIONS.md 2026-10-07): when the user eats vs. what is recommended,
// as pages in a bottom sheet. The web hard-codes these Danish texts.

private class MealRow(val meal: String, val label: String, val avgClock: String, val recommended: String, val verdict: String, val kcalShare: Double, val recommendedShare: Double)

private class MealWindow(val firstClock: String, val lastClock: String, val hours: Double, val lastBeforeBedHours: Double?, val verdict: String)

private class WeekdayVsWeekend(val weekdayFirst: String, val weekendFirst: String, val weekdayKcal: Double, val weekendKcal: Double, val verdict: String)

private class MealInsights(val days: Double, val meals: List<MealRow>, val window: MealWindow, val weekdayVsWeekend: WeekdayVsWeekend?)

private fun parseInsights(obj: JsonObject?): MealInsights? {
    obj ?: return null
    val window = obj["window"].asObject() ?: return null
    return MealInsights(
        days = obj.number("days") ?: 0.0,
        meals = obj.objects("meals").map { m ->
            MealRow(
                m.string("meal") ?: "",
                m.string("label") ?: "",
                m.string("avgClock") ?: "—",
                m.string("recommended") ?: "",
                m.string("verdict") ?: "",
                m.number("kcalShare") ?: 0.0,
                m.number("recommendedShare") ?: 0.0,
            )
        },
        window = MealWindow(
            window.string("firstClock") ?: "—",
            window.string("lastClock") ?: "—",
            window.number("hours") ?: 0.0,
            window.number("lastBeforeBedHours"),
            window.string("verdict") ?: "",
        ),
        weekdayVsWeekend = obj["weekdayVsWeekend"].asObject()?.let { v ->
            WeekdayVsWeekend(
                v.string("weekdayFirst") ?: "—",
                v.string("weekendFirst") ?: "—",
                v.number("weekdayKcal") ?: 0.0,
                v.number("weekendKcal") ?: 0.0,
                v.string("verdict") ?: "",
            )
        },
    )
}

private sealed interface InsightState {
    data object Idle : InsightState
    data object Loading : InsightState
    data object Locked : InsightState
    data object Empty : InsightState
    class Ready(val insights: MealInsights) : InsightState
}

/** MealInsightsButton: "Udregn" (secondary, full width) and its sheet. */
@Composable
internal fun MealInsightsButton(tier: String?) {
    val scope = rememberCoroutineScope()
    var state by remember { mutableStateOf<InsightState>(InsightState.Idle) }

    fun calculate() {
        if (tier != "SERIOUS") {
            state = InsightState.Locked
            return
        }
        state = InsightState.Loading
        scope.launch {
            state = try {
                val response = Api.post("/api/insights/meal-timing") as? JsonObject
                parseInsights(response?.get("insights").asObject())?.let { InsightState.Ready(it) } ?: InsightState.Empty
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                if (e.status == 403) InsightState.Locked else InsightState.Empty
            } catch (e: Exception) {
                InsightState.Empty
            }
        }
    }

    HcButton(
        if (state == InsightState.Loading) "Udregner …" else "Udregn",
        onClick = ::calculate,
        kind = HcButtonKind.Secondary,
        enabled = state != InsightState.Loading,
    )

    val current = state
    if (current is InsightState.Locked || current is InsightState.Empty || current is InsightState.Ready) {
        // size="half": a fixed half-screen panel whose body scrolls (.hf-bottom-sheet__body).
        HcBottomSheet(
            onDismiss = { state = InsightState.Idle },
            title = "Indsigter i dine måltider",
            size = HcSheetSize.Half,
            scrollable = true,
        ) {
            if (current is InsightState.Ready) InsightPages(current.insights)
            else InsightMessage(locked = current is InsightState.Locked)
        }
    }
}

@Composable
private fun InsightMessage(locked: Boolean) {
    val nav = LocalNavigator.current
    // useBottomSheetClose(): slides the sheet out, then dismisses it.
    val close = LocalHcSheetClose.current
    Column(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        HcText(if (locked) "Udregn kræver Seriøs" else "Ikke nok data endnu", HcTypeRoles.PageTitle, color = HcColors.Black)
        HcText(
            if (locked) "Indsigter i hvornår du spiser og hvad der anbefales er en del af Seriøs-abonnementet."
            else "Registrér mad på mindst 3 forskellige dage inden for 30 dage, så kan vi regne dine spisetidspunkter ud.",
            HcTypeRoles.Body,
            color = HcColors.TextSecondary,
        )
        if (locked) {
            HcText(
                "Se abonnementer",
                HcTypeRoles.Body,
                Modifier.clickable {
                    close()
                    nav.push("/profile/subscription")
                },
                color = HcColors.Green,
                bold = true,
                underline = true,
            )
        }
    }
}

private class InsightPage(val title: String, val body: @Composable () -> Unit)

@Composable
private fun InsightLine(strong: String, small: String) {
    Column {
        HcText(strong, HcTypeRoles.Body, bold = true, color = HcColors.Black)
        HcText(small, HcTypeRoles.Small, color = HcColors.TextSecondary)
    }
}

@Composable
private fun InsightPages(insights: MealInsights) {
    var page by remember { mutableIntStateOf(0) }
    val close = LocalHcSheetClose.current
    val w = insights.window
    val pages = buildList {
        add(InsightPage("Hvornår spiser du?") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                insights.meals.filter { it.meal != "snack" }.forEach { m ->
                    InsightLine("${m.label}: ${m.avgClock}", "Anbefalet ${m.recommended}. ${m.verdict}")
                }
            }
        })
        add(InsightPage("Dit spisevindue") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcText("Første indtag i snit ${w.firstClock}, sidste ${w.lastClock} (${jsNumber(w.hours)} timer).", HcTypeRoles.Body, color = HcColors.Black)
                w.lastBeforeBedHours?.let {
                    HcText("Sidste indtag er ca. ${jsNumber(it)} timer før sengetid.", HcTypeRoles.Body, color = HcColors.Black)
                }
                HcText(w.verdict, HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
        })
        add(InsightPage("Fordeling over dagen") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                insights.meals.forEach { m ->
                    InsightLine(
                        "${m.label}: ${(m.kcalShare * 100).roundToInt()} % af dit indtag",
                        "Typisk anbefaling ca. ${(m.recommendedShare * 100).roundToInt()} %.",
                    )
                }
            }
        })
        insights.weekdayVsWeekend?.let { v ->
            add(InsightPage("Hverdag vs. weekend") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText("Hverdage: første måltid ${v.weekdayFirst}, ${jsNumber(v.weekdayKcal)} kcal/dag.", HcTypeRoles.Body, color = HcColors.Black)
                    HcText("Weekend: første måltid ${v.weekendFirst}, ${jsNumber(v.weekendKcal)} kcal/dag.", HcTypeRoles.Body, color = HcColors.Black)
                    HcText(v.verdict, HcTypeRoles.Small, color = HcColors.TextSecondary)
                }
            })
        }
    }
    val current = pages[page.coerceIn(0, pages.lastIndex)]
    val last = page >= pages.lastIndex

    Column(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(Modifier.fillMaxWidth().heightIn(min = 44.dp), contentAlignment = Alignment.Center) {
            HcSheetDots(pages.size, page)
        }
        HcText(current.title, HcTypeRoles.PageTitle, color = HcColors.Black)
        current.body()
        HcText("Beregnet ud fra dine seneste ${jsNumber(insights.days)} dage med registreringer.", HcTypeRoles.Small, color = HcColors.Inactive)
        Column(Modifier.fillMaxWidth().padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            HcButton(if (last) "Luk" else "Næste", onClick = { if (last) close() else page += 1 })
            if (page > 0) {
                HcText(
                    "Tilbage",
                    HcTypeRoles.Body,
                    Modifier.clickable { page -= 1 }.padding(vertical = 8.dp),
                    color = HcColors.TextSecondary,
                    bold = true,
                    underline = true,
                )
            }
        }
    }
}

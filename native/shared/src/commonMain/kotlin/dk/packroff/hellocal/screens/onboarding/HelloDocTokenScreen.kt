package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HelloDocDashboardLayout
import dk.packroff.hellocal.ui.HelloDocDashboardMenu
import dk.packroff.hellocal.ui.rememberHelloDocDashboardLayout
import dk.packroff.hellocal.ui.OnbChartPoint
import dk.packroff.hellocal.ui.OnbMiniBarChart
import dk.packroff.hellocal.ui.OnbMiniLineChart
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlin.math.roundToLong

// GET /api/hello-doc/[token] (src/app/api/hello-doc/[token]/route.ts).
@Serializable
internal data class HelloDocResponse(
    val status: String = "NOT_FOUND",
    val ownerName: String = "",
    val doctorName: String = "",
    val categories: List<String>? = null,
    val expiresAt: String? = null,
    val profile: HelloDocProfile? = null,
    val weight: HelloDocWeight? = null,
    val goals: HelloDocGoals? = null,
    val sleep: HelloDocSleep? = null,
    val dailyNutrition: List<HelloDocDay>? = null,
    val fluidHistory: List<HelloDocFluid>? = null,
)

@Serializable internal data class HelloDocProfile(val displayName: String = "", val email: String = "")
@Serializable internal data class HelloDocWeightPoint(val date: String, val weightKg: Double)
@Serializable internal data class HelloDocWeight(val startWeightKg: Double? = null, val startWeightRecordedAt: String = "", val history: List<HelloDocWeightPoint> = emptyList())
@Serializable internal data class HelloDocGoals(val targetWeightKg: Double? = null)
@Serializable internal data class HelloDocSleep(val defaultBedtime: String? = null, val defaultWakeTime: String? = null)
@Serializable internal data class HelloDocDay(
    val dateKey: String = "",
    val kcal: Double = 0.0,
    val vitaminA: Double = 0.0,
    val vitaminC: Double = 0.0,
    val calcium: Double = 0.0,
    val iron: Double = 0.0,
    val potassium: Double = 0.0,
)
@Serializable internal data class HelloDocFluid(val date: String, val valueMl: Double)

private val CATEGORY_LABEL_KEY = mapOf(
    "profile" to "helloDoc.categoryProfile",
    "weight" to "helloDoc.categoryWeight",
    "goals" to "helloDoc.categoryGoals",
    "menstrualCycle" to "helloDoc.categoryMenstrualCycle",
    "digestion" to "helloDoc.categoryDigestion",
    "sleep" to "helloDoc.categorySleep",
    "foodAndCalories" to "helloDoc.categoryFoodAndCalories",
    "vitaminsMinerals" to "helloDoc.categoryVitaminsMinerals",
    "fluid" to "helloDoc.categoryFluid",
)

/** src/lib/doctor-share.ts DOCTOR_SHARE_UNAVAILABLE_CATEGORIES. */
private val UNAVAILABLE_CATEGORIES = setOf("menstrualCycle", "digestion")

/**
 * Native port of src/app/hello-doc/[token]/page.tsx — the login-free "Hello Doc"
 * view a doctor/dietitian opens from the invitation e-mail. The token in the
 * URL is the access control. PENDING = accept step, ACTIVE = the shared data.
 */
@Composable
fun HelloDocTokenScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val token = args["token"]
    var data by remember(token) { mutableStateOf<HelloDocResponse?>(null) }
    var loadError by remember(token) { mutableStateOf(false) }
    var accepting by remember { mutableStateOf(false) }
    var acceptError by remember { mutableStateOf(false) }

    suspend fun fetchShare(): HelloDocResponse {
        val path = "/api/hello-doc/" + Location.encode(token)
        val json: JsonElement = try {
            Api.get(path)
        } catch (e: ApiException) {
            // 404 carries { status: "NOT_FOUND" } like the web's res.status === 404 branch.
            if (e.status == 404) e.body ?: throw e else throw e
        }
        return ApiJson.decodeFromJsonElement(HelloDocResponse.serializer(), json)
    }

    LaunchedEffect(token) {
        try {
            data = fetchShare()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            loadError = true
        }
    }

    fun accept() {
        accepting = true
        acceptError = false
        scope.launch {
            try {
                Api.post("/api/hello-doc/" + Location.encode(token))
                data = fetchShare()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                acceptError = true
            }
            accepting = false
        }
    }

    val layout = rememberHelloDocDashboardLayout()

    Column(Modifier.fillMaxSize().background(HcColors.Page)) {
        // .hf-shell__topbar: logo + "Hello Doc".
        Row(
            Modifier.fillMaxWidth().background(HcColors.Page).statusBarsPadding().height(HcDimens.ShellBar).padding(horizontal = HcDimens.Gutter),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
        ) {
            HcRemoteImage("/hello-cal-logo.png", Modifier.width(90.dp).height(40.dp), contentDescription = "Hello Cal")
            HcText("Hello Doc", HcTypeRoles.Title)
            val active = data
            if (active != null && active.status == "ACTIVE") {
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                    HelloDocDashboardMenu(layout, available = availablePanels(active))
                }
            }
        }

        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                .padding(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection),
            verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
        ) {
            val share = data
            when {
                share == null && !loadError -> HcLoader()
                share == null -> HcText(
                    t.t("helloDoc.token.loadError"),
                    HcTypeRoles.Body,
                    Modifier.fillMaxWidth().padding(16.dp),
                    color = HcColors.Danger,
                    align = TextAlign.Center,
                )
                share.status == "NOT_FOUND" -> StatusCard(t.t("helloDoc.token.notFoundTitle"), t.t("helloDoc.token.notFoundBody"))
                share.status == "REVOKED" -> StatusCard(
                    t.t("helloDoc.token.revokedTitle"),
                    t.t("helloDoc.token.revokedBody", "ownerName" to share.ownerName),
                )
                share.status == "EXPIRED" -> StatusCard(
                    t.t("helloDoc.token.expiredTitle"),
                    t.t("helloDoc.token.expiredBody", "ownerName" to share.ownerName),
                )
                share.status == "PENDING" -> CenterCard {
                    HcText(t.t("helloDoc.token.pendingTitle", "ownerName" to share.ownerName), HcTypeRoles.PageTitle, Modifier.fillMaxWidth(), align = TextAlign.Center)
                    HcText(
                        t.t("helloDoc.token.pendingBody", "ownerName" to share.ownerName),
                        HcTypeRoles.Body,
                        Modifier.fillMaxWidth(),
                        color = HcColors.TextSecondary,
                        align = TextAlign.Center,
                    )
                    val categories = share.categories.orEmpty().filter { it !in UNAVAILABLE_CATEGORIES }
                    if (!share.categories.isNullOrEmpty()) {
                        Panel {
                            HcText(t.t("helloDoc.token.pendingSharedListTitle"), HcTypeRoles.Caption)
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                for (category in categories) {
                                    CATEGORY_LABEL_KEY[category]?.let { HcText(t.t(it), HcTypeRoles.Body) }
                                }
                            }
                        }
                    }
                    share.expiresAt?.let {
                        HcText(
                            t.t("helloDoc.token.expiresHint", "date" to formatInsightDate(it, t.locale)),
                            HcTypeRoles.Caption,
                            Modifier.fillMaxWidth(),
                            align = TextAlign.Center,
                        )
                    }
                    if (acceptError) {
                        HcText(t.t("helloDoc.token.acceptError"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.Danger, align = TextAlign.Center)
                    }
                    HcButton(
                        if (accepting) t.t("helloDoc.token.accepting") else t.t("helloDoc.token.acceptButton"),
                        onClick = ::accept,
                        enabled = !accepting,
                    )
                }
                share.status == "ACTIVE" -> {
                    val categories = share.categories.orEmpty()
                    HelloDocInsight(
                        share,
                        showFood = "foodAndCalories" in categories,
                        showVitamins = "vitaminsMinerals" in categories,
                        greeting = t.t("helloDoc.token.greeting", "name" to share.doctorName),
                        layout = layout,
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusCard(title: String, body: String) {
    CenterCard {
        HcText(title, HcTypeRoles.PageTitle, Modifier.fillMaxWidth(), align = TextAlign.Center)
        HcText(body, HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
    }
}

/** .hf-card.hf-insight__center: centred card, max 28rem, 32 px from the top. */
@Composable
private fun CenterCard(content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxWidth().padding(top = HcDimens.SpaceSection), contentAlignment = Alignment.TopCenter) {
        HcCard(Modifier.widthIn(max = 448.dp), content = content)
    }
}

/** .hf-panel: white surface, thin nav-coloured border, 16 px padding, 8 px gap. */
@Composable
private fun Panel(content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(HcColors.Surface).border(1.dp, HcColors.Nav, shape).padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
        content = content,
    )
}

/** src/components/hf/HelloDocInsight.tsx (phone layout: profile card above the chart panels). */
@Composable
private fun HelloDocInsight(data: HelloDocResponse, showFood: Boolean, showVitamins: Boolean, greeting: String?, layout: HelloDocDashboardLayout) {
    val t = LocalTranslator.current
    val hasFacts = data.weight != null || data.goals != null || data.sleep != null
    Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
        HcCard {
            Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
                greeting?.let { HcText(it, HcTypeRoles.Body) }
                data.profile?.let { profile ->
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(96.dp).clip(CircleShape).background(HcColors.Nav), contentAlignment = Alignment.Center) {
                            HcText(initials(profile.displayName), HcTypeRoles.PageTitle, color = HcColors.Action)
                        }
                        HcText(profile.displayName, HcTypeRoles.Title, align = TextAlign.Center)
                        HcText(profile.email, HcTypeRoles.Caption, align = TextAlign.Center)
                    }
                }
                if (hasFacts) {
                    // .hf-insight__facts: separated by a thin line.
                    Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.Line))
                    Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
                        data.weight?.let { weight ->
                            Column {
                                HcText(t.t("helloDoc.preview.startWeight"), HcTypeRoles.Caption)
                                HcText(weight.startWeightKg?.let { "${jsNumber(it)} kg" } ?: "—", HcTypeRoles.Body)
                                HcText(
                                    t.t("helloDoc.preview.recordedOn", "date" to formatInsightDate(weight.startWeightRecordedAt, t.locale)),
                                    HcTypeRoles.Caption,
                                )
                            }
                        }
                        data.goals?.let { goals ->
                            Column {
                                HcText(t.t("helloDoc.preview.startGoal"), HcTypeRoles.Caption)
                                HcText(goals.targetWeightKg?.let { "${jsNumber(it)} kg" } ?: "—", HcTypeRoles.Body)
                            }
                        }
                        data.sleep?.let { sleep ->
                            Column {
                                HcText(t.t("helloDoc.preview.sleepSection"), HcTypeRoles.Caption)
                                HcText(
                                    "${t.t("helloDoc.preview.sleepBedtime")}: ${sleep.defaultBedtime ?: t.t("helloDoc.preview.sleepNotSet")}",
                                    HcTypeRoles.Body,
                                )
                                HcText(
                                    "${t.t("helloDoc.preview.sleepWakeTime")}: ${sleep.defaultWakeTime ?: t.t("helloDoc.preview.sleepNotSet")}",
                                    HcTypeRoles.Body,
                                )
                            }
                        }
                    }
                }
            }
        }

        // InsightGrid
        val noData = t.t("helloDoc.preview.noChartData")
        val days = data.dailyNutrition
        for (id in layout.visible()) {
            when (id) {
                "weight" -> data.weight?.let { weight ->
                    InsightPanel(t.t("helloDoc.preview.weightSection")) {
                        OnbMiniLineChart(weight.history.map { OnbChartPoint(formatInsightDate(it.date, t.locale), it.weightKg) }, emptyLabel = noData)
                    }
                }
                "food" -> if (days != null && showFood) {
                    InsightPanel(t.t("helloDoc.preview.foodSection"), footnote = "${t.t("helloDoc.preview.kcalUnit")}/dag") {
                        OnbMiniBarChart(days.map { OnbChartPoint(it.dateKey, it.kcal.roundToLong().toDouble()) }, emptyLabel = noData)
                    }
                }
                "vitamins" -> if (days != null && showVitamins) {
                    val points = listOf(
                        OnbChartPoint("Vitamin A", days.sumOf { it.vitaminA }.roundToLong().toDouble()),
                        OnbChartPoint("Vitamin C", days.sumOf { it.vitaminC }.roundToLong().toDouble()),
                        OnbChartPoint("Calcium", days.sumOf { it.calcium }.roundToLong().toDouble()),
                        OnbChartPoint("Jern", days.sumOf { it.iron }.roundToLong().toDouble()),
                        OnbChartPoint("Kalium", days.sumOf { it.potassium }.roundToLong().toDouble()),
                    )
                    InsightPanel(t.t("helloDoc.preview.vitaminsSection")) {
                        OnbMiniBarChart(points, color = HcColors.Appbar, emptyLabel = noData)
                    }
                }
                "fluid" -> data.fluidHistory?.let { fluid ->
                    InsightPanel(t.t("helloDoc.preview.fluidSection")) {
                        OnbMiniBarChart(fluid.map { OnbChartPoint(formatInsightDate(it.date, t.locale), it.valueMl) }, color = HcColors.Google, emptyLabel = noData)
                    }
                }
            }
        }
    }
}

/** Panels the recipient may arrange (HelloDocTokenPage availablePanels). */
private fun availablePanels(data: HelloDocResponse): List<String> {
    val categories = data.categories.orEmpty()
    return buildList {
        if (data.weight != null) add("weight")
        if (data.dailyNutrition != null && "foodAndCalories" in categories) add("food")
        if (data.dailyNutrition != null && "vitaminsMinerals" in categories) add("vitamins")
        if (data.fluidHistory != null) add("fluid")
    }
}

@Composable
private fun InsightPanel(title: String, footnote: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Panel {
        HcText(title, HcTypeRoles.Title)
        content()
        footnote?.let { HcText(it, HcTypeRoles.Caption, Modifier.fillMaxWidth(), align = TextAlign.End) }
    }
}

private fun initials(name: String): String =
    name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.map { it.first() }.take(2).joinToString("").uppercase()

/** JavaScript's Number → string ("80", "80.5"), as the web prints `${kg} kg`. */
internal fun jsNumber(value: Double): String =
    if (value == value.roundToLong().toDouble()) value.roundToLong().toString() else value.toString()

private val MONTHS_SHORT = mapOf(
    Locale.Da to listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."),
    Locale.No to listOf("jan.", "feb.", "mar.", "apr.", "mai", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "des."),
    Locale.Sv to listOf("jan.", "feb.", "mars", "apr.", "maj", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."),
    Locale.De to listOf("Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."),
    Locale.Nl to listOf("jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"),
    Locale.Fr to listOf("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."),
    Locale.En to listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"),
)

/** formatInsightDate(): Intl day numeric, month short, year numeric ("8. okt. 2026"). */
internal fun formatInsightDate(value: String, locale: Locale): String {
    val date = runCatching {
        if (value.length <= 10) LocalDate.parse(value) else Instant.parse(value).toLocalDateTime(TimeZone.currentSystemDefault()).date
    }.getOrNull() ?: return value
    val month = (MONTHS_SHORT[locale] ?: MONTHS_SHORT.getValue(Locale.Da))[date.monthNumber - 1]
    val day = date.dayOfMonth
    return when (locale) {
        Locale.Da, Locale.No, Locale.De -> "$day. $month ${date.year}"
        else -> "$day $month ${date.year}"
    }
}

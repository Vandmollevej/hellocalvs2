package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.WeightUnit
import dk.packroff.hellocal.ui.HeightUnit
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcSheetDots
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcSheetSkipButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.ProfileChoiceChip
import dk.packroff.hellocal.ui.ProfileTermsHint
import dk.packroff.hellocal.ui.ProfileTermsSheet
import dk.packroff.hellocal.ui.ProfileTextButton
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

// src/components/OnboardingWizard.tsx + src/components/onboarding/ActivityStep.tsx
// — the start guide in a bottom sheet. On Profil it is opened by "Lær appen at
// kende" (forceVisible). Closing by dragging/scrim counts as "Påmind mig senere".

private val ALL_STEPS = listOf("units", "sleep-pattern", "shift-work", "daily-log-preference", "calendar-view", "activity", "health-import")
private val ACTIVITY_PAGES = listOf("intro", "work", "walkStand", "transport", "steps", "training", "intensity", "result", "goal")
private val WORK_TYPES = listOf("SITTING", "MOSTLY_SITTING", "MIXED", "MOSTLY_STANDING", "PHYSICAL")
private val WALK_STAND_HOURS = listOf("UNDER_1", "H1_2", "H2_4", "H4_6", "OVER_6")
private val TRANSPORT_TYPES = listOf("MOTORIZED", "LITTLE_WALKING", "SOME_WALKING", "REGULAR_ACTIVE", "DAILY_ACTIVE")
private val STEP_BANDS = listOf("UNDER_3K", "K3_5", "K5_7_5", "K7_5_10", "K10_15", "OVER_15K")
private val TRAINING_INTENSITIES = listOf("LIGHT", "MODERATE", "VIGOROUS", "VERY_VIGOROUS")
private val ACTIVITY_LEVEL_KEYS = listOf("VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH")
private val SESSIONS = listOf(0, 1, 2, 3, 4, 5, 6, 7)
private val MINUTES = listOf(15, 30, 45, 60, 90)
private val CALENDAR_DEFAULT_VIEWS = listOf("list", "month", "week", "day")

private const val CALENDAR_VIEW_KEY = "hellocal.kalender.defaultView"

/** src/lib/terms-hints.ts ONBOARDING_TERMS */
private val ONBOARDING_TERMS = mapOf(
    "units" to ProfileTermsHint(
        "hvad-er-hello-cal",
        listOf(
            "Valget af vægt- og længdeenheder gemmes kun på denne enhed og ændrer blot, hvordan tallene vises og indtastes. Din vægt og højde gemmes altid ens, uanset hvilken enhed du vælger.",
            "Du kan altid skifte under Indstillinger → Sprog og region.",
        ),
    ),
    "sleep-pattern" to ProfileTermsHint(
        "hvad-er-hello-cal",
        listOf(
            "Dit svar om søvnmønster bruges kun til at dele dit døgn rigtigt op i kalenderen og i dine tal. Det hører til din egen konto og deles ikke med andre.",
            "Du kan altid ændre svaret senere under Indstillinger.",
            "Hello Cal er et værktøj, ikke en læge. Søvn- og kalorietal er vejledende og erstatter ikke rådgivning fra en læge eller anden sundhedsperson.",
        ),
    ),
    "shift-work" to ProfileTermsHint(
        "ansvar",
        listOf(
            "Arbejder du på skiftehold, følger dit døgn ikke altid kalenderen. Svarer du ja, kan du registrere efter dine egne døgn i stedet for fra midnat til midnat.",
            "Beregninger af kalorier, søvn og energi bygger på det, du selv registrerer. De er vejledende og kan indeholde fejl, og vi kan ikke love fejlfri tal.",
            "Svaret kan ændres når som helst under Indstillinger.",
        ),
    ),
    "daily-log-preference" to ProfileTermsHint(
        "hvad-er-hello-cal",
        listOf(
            "Her vælger du, om din dag i Hello Cal starter og slutter ved dine arbejdstider eller ved dine sovetider.",
            "Valget ændrer kun, hvordan dine egne registreringer samles pr. dag. Selve registreringerne bliver ikke ændret eller slettet, og du kan skifte når som helst.",
        ),
    ),
    "calendar-view" to ProfileTermsHint(
        "hvad-er-hello-cal",
        listOf(
            "Valget af kalendervisning gemmes kun på denne enhed og bestemmer blot, hvordan kalenderen åbner.",
            "Du kan altid skifte visning i kalenderen eller ændre standarden under Indstillinger → Visning → Kalendervisning.",
        ),
    ),
    "activity" to ProfileTermsHint(
        "hvad-er-hello-cal",
        listOf(
            "Dine svar om arbejde, gang, transport og motion bruges kun til at anslå dit daglige energibehov. Tallet er et estimat med et interval — ikke en måling.",
            "Hello Cal foreslår aldrig et kaloriemål under det, der regnes som sundt, og tallene erstatter ikke rådgivning fra en læge eller diætist.",
            "Du kan altid ændre dit aktivitetsniveau under Profil, og estimatet justeres løbende, når appen får vægt- og aktivitetsdata.",
        ),
    ),
    "health-import" to ProfileTermsHint(
        "integrationer",
        listOf(
            "Henter du data fra Apple Sundhed, Health Connect eller et ur, henter Hello Cal kun de datatyper, du selv slår til.",
            "Du kan slå hver datatype fra og afbryde forbindelsen når som helst under Indstillinger → Integrationer. Når du afbryder, henter vi ikke flere data.",
            "Data fra andre apps kan være forkerte, forsinkede eller mangle, og Hello Cal kan ikke stå inde for dem. Den anden app har sine egne vilkår.",
        ),
    ),
)

/** src/lib/pal-model.ts ActivityAnswers ("Ved ikke" = null). */
private data class Training(val sessionsPerWeek: Int, val sessionMinutes: Int, val intensity: String?)

private data class ActivityAnswers(
    val work: String? = null,
    val walkStand: String? = null,
    val transport: String? = null,
    val steps: String? = null,
    val stepsMeasured: Boolean = false,
    val training: Training? = null,
) {
    fun toJson(): JsonObject = JsonObject(
        mapOf(
            "version" to JsonPrimitive(1),
            "work" to (work?.let { JsonPrimitive(it) } ?: JsonNull),
            "walkStand" to (walkStand?.let { JsonPrimitive(it) } ?: JsonNull),
            "transport" to (transport?.let { JsonPrimitive(it) } ?: JsonNull),
            "steps" to (steps?.let { JsonPrimitive(it) } ?: JsonNull),
            "stepsMeasured" to JsonPrimitive(stepsMeasured),
            "training" to (
                training?.let {
                    JsonObject(
                        mapOf(
                            "sessionsPerWeek" to JsonPrimitive(it.sessionsPerWeek),
                            "sessionMinutes" to JsonPrimitive(it.sessionMinutes),
                            "intensity" to (it.intensity?.let { i -> JsonPrimitive(i) } ?: JsonNull),
                        ),
                    )
                } ?: JsonNull
                ),
        ),
    )
}

private fun visibleSteps(hasRegularSleep: Boolean?, shiftWork: Boolean?): List<String> = ALL_STEPS.filter { step ->
    when (step) {
        "shift-work" -> hasRegularSleep == false
        "daily-log-preference" -> hasRegularSleep == false && shiftWork == true
        else -> true
    }
}

/** The activity step's own pages; intensity is skipped without exercise. */
private fun visibleActivityPages(answers: ActivityAnswers): List<String> = ACTIVITY_PAGES.filter { it != "intensity" || answers.training != null }

/** OnboardingWizard: shown when not completed/dismissed, or always with [forceVisible]. */
@Composable
fun ProfileOnboardingWizard(forceVisible: Boolean = false, onClose: (() -> Unit)? = null) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var visible by remember { mutableStateOf(false) }
    var hasRegularSleep by remember { mutableStateOf<Boolean?>(null) }
    var shiftWork by remember { mutableStateOf<Boolean?>(null) }
    var dailyLogPreference by remember { mutableStateOf<String?>(null) }
    var stepIndex by remember { mutableStateOf(0) }
    var canDismissPermanently by remember { mutableStateOf(false) }
    var units by remember { mutableStateOf(Units.current()) }
    var calendarView by remember { mutableStateOf(runCatching { NativeHooks.secureStorage.get(CALENDAR_VIEW_KEY) }.getOrNull()?.takeIf { it in CALENDAR_DEFAULT_VIEWS } ?: "month") }
    var activityPageIndex by remember { mutableStateOf(0) }
    var activityAnswers by remember { mutableStateOf(ActivityAnswers()) }
    var activitySummary by remember { mutableStateOf<EnergySummary?>(null) }
    var suggestedLevel by remember { mutableStateOf<String?>(null) }
    var goalUser by remember { mutableStateOf<EnergyGoalUser?>(null) }
    var exitReason by remember { mutableStateOf("remind") }

    LaunchedEffect(forceVisible) {
        val obj = runCatching { (Api.get("/api/profile") as JsonObject)["user"] as? JsonObject }.getOrNull() ?: return@LaunchedEffect
        val user = runCatching { ApiJson.decodeFromJsonElement(ProfileUser.serializer(), obj) }.getOrNull() ?: return@LaunchedEffect
        // setUnitsRegion: the profile's country decides the automatic unit default.
        Units.setRegion(user.region)
        units = Units.current()
        goalUser = EnergyGoalUser.from(user)
        shiftWork = if (user.shiftWorkEnabled) true else null
        dailyLogPreference = obj["dailyLogPreference"]?.jsonPrimitive?.contentOrNull
        canDismissPermanently = obj["onboardingRemindLaterAt"]?.jsonPrimitive?.contentOrNull != null
        val completed = obj["onboardingCompletedAt"]?.jsonPrimitive?.contentOrNull != null
        val dismissed = obj["onboardingDismissed"]?.jsonPrimitive?.contentOrNull == "true"
        if (!(completed || dismissed) || forceVisible) visible = true
    }

    if (!visible) return

    val steps = visibleSteps(hasRegularSleep, shiftWork)
    val currentStep = steps.getOrNull(stepIndex)
    val totalSteps = steps.size

    fun save(data: Map<String, Any?>) {
        scope.launch { runCatching { ProfileApi.patch(data) } }
    }

    // How the sheet was closed decides what is saved: complete, dismiss, or remind (drag/scrim).
    fun close(reason: String) {
        when (reason) {
            "complete" -> save(mapOf("onboardingCompletedAt" to Clock.System.now().toString()))
            "dismiss" -> save(mapOf("onboardingDismissed" to true))
            else -> save(mapOf("onboardingRemindLaterAt" to Clock.System.now().toString()))
        }
        visible = false
        onClose?.invoke()
    }

    val activityPages = visibleActivityPages(activityAnswers)
    val activityPage = activityPages[minOf(activityPageIndex, activityPages.size - 1)]
    val onActivityLastPage = activityPageIndex + 1 >= activityPages.size

    // The answers go to the server when the result page opens; it computes PAL and the calculation.
    fun submitActivityAnswers() {
        scope.launch {
            runCatching {
                val response = Api.put("/api/profile/activity", JsonObject(mapOf("answers" to activityAnswers.toJson()))) as JsonObject
                val summary = ApiJson.decodeFromJsonElement(EnergySummary.serializer(), response["summary"]!!)
                activitySummary = summary
                suggestedLevel = summary.level
            }
        }
    }

    fun pickActivityLevel(level: String) {
        activitySummary = activitySummary?.copy(level = level)
        scope.launch {
            runCatching {
                val response = Api.patch("/api/profile/activity", mapOf("activityLevel" to level)) as JsonObject
                activitySummary = ApiJson.decodeFromJsonElement(EnergySummary.serializer(), response["summary"]!!)
            }
        }
    }

    fun goNext() {
        if (currentStep == "activity" && !onActivityLastPage) {
            val nextPage = activityPageIndex + 1
            activityPageIndex = nextPage
            if (activityPages[nextPage] == "result") submitActivityAnswers()
            return
        }
        val nextIndex = stepIndex + 1
        stepIndex = nextIndex
        save(mapOf("onboardingStep" to nextIndex))
    }

    val isLastStep = stepIndex + 1 >= totalSteps

    // Footer buttons close with the slide-out animation; how the sheet was closed
    // decides what is saved (dragging/scrim = "Påmind mig senere").
    HcBottomSheet(
        onDismiss = { close(exitReason) },
        title = t.t("onboarding.stepProgress", "current" to stepIndex + 1, "total" to totalSteps),
        size = HcSheetSize.Full,
        footer = {
            val sheetClose = LocalHcSheetClose.current
            if (currentStep != null) key(currentStep) { ONBOARDING_TERMS[currentStep]?.let { ProfileTermsSheet(it) } }
            Box(Modifier.fillMaxWidth().padding(bottom = 16.dp), contentAlignment = Alignment.Center) {
                HcSheetDots(totalSteps, stepIndex)
            }
            HcButton(t.t("onboarding.next"), onClick = {
                if (isLastStep) {
                    exitReason = "complete"
                    sheetClose()
                } else {
                    goNext()
                }
            })
            HcSheetSkipButton(t.t("onboarding.remindLater")) { exitReason = "remind" }
            if (canDismissPermanently) {
                Box(
                    Modifier.fillMaxWidth().height(40.dp).clickable {
                        exitReason = "dismiss"
                        sheetClose()
                    },
                    contentAlignment = Alignment.Center,
                ) {
                    HcText(t.t("onboarding.doNotShowAgain"), HcTypeRoles.Small, bold = true, color = HcColors.TextSecondary)
                }
            }
        },
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight()) {
            Column(
                Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(32.dp, Alignment.CenterVertically),
            ) {
                when (currentStep) {
                    "units" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Heading(t.t("onboarding.unitsQuestion"))
                        HcText(t.t("onboarding.unitsHint"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            WeightUnit.entries.forEach { unit ->
                                WideChoice(Units.weightUnitLabel(unit), units.weight == unit, Modifier.weight(1f)) {
                                    Units.save(weight = unit)
                                    units = Units.current()
                                }
                            }
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            HeightUnit.entries.forEach { unit ->
                                WideChoice(unit.code, units.height == unit, Modifier.weight(1f)) {
                                    Units.save(height = unit)
                                    units = Units.current()
                                }
                            }
                        }
                    }
                    "sleep-pattern" -> YesNoStep(t.t("onboarding.sleepPatternQuestion"), hasRegularSleep) { value ->
                        hasRegularSleep = value
                        if (value) save(mapOf("shiftWorkEnabled" to false, "dailyLogPreference" to null))
                    }
                    "shift-work" -> YesNoStep(t.t("onboarding.shiftWorkQuestion"), shiftWork) { value ->
                        shiftWork = value
                        save(mapOf("shiftWorkEnabled" to value))
                    }
                    "daily-log-preference" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Heading(t.t("onboarding.dailyLogQuestion"))
                        listOf("WORK_HOURS" to "onboarding.workHours", "SLEEP_TIMES" to "onboarding.sleepTimes").forEach { (value, labelKey) ->
                            WideChoice(t.t(labelKey), dailyLogPreference == value, Modifier.fillMaxWidth()) {
                                dailyLogPreference = value
                                save(mapOf("dailyLogPreference" to value))
                            }
                        }
                    }
                    "calendar-view" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Heading(t.t("onboarding.calendarViewQuestion"))
                        HcText(t.t("onboarding.calendarViewHint"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                        CALENDAR_DEFAULT_VIEWS.chunked(2).forEach { row ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                row.forEach { view ->
                                    WideChoice(t.t("calendarViewSettings.option${view.replaceFirstChar { it.uppercase() }}"), calendarView == view, Modifier.weight(1f)) {
                                        calendarView = view
                                        runCatching { NativeHooks.secureStorage.set(CALENDAR_VIEW_KEY, view) }
                                    }
                                }
                            }
                        }
                    }
                    "activity" -> ActivityStep(
                        page = activityPage,
                        answers = activityAnswers,
                        onChange = { activityAnswers = it },
                        summary = activitySummary,
                        suggestedLevel = suggestedLevel,
                        onPickLevel = ::pickActivityLevel,
                        goalUser = goalUser,
                        onGoalChange = { nextUser, nextSummary ->
                            goalUser = nextUser
                            if (nextSummary != null) activitySummary = nextSummary
                        },
                        onOpenIntegrations = {
                            close("remind")
                            nav.push("/settings/integrations")
                        },
                    )
                    "health-import" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Heading(t.t("onboarding.healthImportQuestion"))
                        HcText(t.t("onboarding.healthImportHint"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                        HcButton(t.t("onboarding.setUpNow"), onClick = {
                            save(mapOf("healthImportRequested" to true))
                            if (isLastStep) close("complete") else goNext()
                        }, kind = HcButtonKind.Secondary)
                    }
                }
            }
        }
    }
}

@Composable
private fun Heading(text: String) {
    HcText(text, HcTypeRoles.BodyLg, bold = true, color = HcColors.Black)
}

/** ChoiceButton / Choice: a 48 px rounded-xl choice, lime with a dark ring when selected (.hf-selected). */
@Composable
private fun WideChoice(label: String, selected: Boolean, modifier: Modifier = Modifier, alignStart: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier.height(48.dp).clip(shape).background(if (selected) HcColors.SelectedBg else HcColors.Tan, shape)
            .let { if (selected) it.border(2.dp, HcColors.SelectedBorder, shape) else it }
            .clickable(onClick = onClick).padding(horizontal = 16.dp),
        contentAlignment = if (alignStart) Alignment.CenterStart else Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Body, bold = true, color = if (selected) HcColors.SelectedText else HcColors.Black, maxLines = 1)
    }
}

@Composable
private fun YesNoStep(question: String, value: Boolean?, onChange: (Boolean) -> Unit) {
    val t = LocalTranslator.current
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Heading(question)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            WideChoice(t.t("onboarding.yes"), value == true, Modifier.weight(1f)) { onChange(true) }
            WideChoice(t.t("onboarding.no"), value == false, Modifier.weight(1f)) { onChange(false) }
        }
    }
}

@Composable
private fun Question(title: String, hint: String? = null, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Heading(title)
        if (hint != null) HcText(hint, HcTypeRoles.Body, color = HcColors.TextSecondary)
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
}

/** src/components/onboarding/ActivityStep.tsx — one page per question, "Ved ikke" always possible, then the result. */
@Composable
private fun ActivityStep(
    page: String,
    answers: ActivityAnswers,
    onChange: (ActivityAnswers) -> Unit,
    summary: EnergySummary?,
    suggestedLevel: String?,
    onPickLevel: (String) -> Unit,
    goalUser: EnergyGoalUser?,
    onGoalChange: (EnergyGoalUser, EnergySummary?) -> Unit,
    onOpenIntegrations: () -> Unit,
) {
    val t = LocalTranslator.current
    val training = answers.training ?: Training(0, 45, null)
    fun setTraining(next: Training) = onChange(answers.copy(training = if (next.sessionsPerWeek > 0) next else null))

    when (page) {
        "intro" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Heading(t.t("onboarding.activity.introTitle"))
            HcText(t.t("onboarding.activity.introBody"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            HcText(t.t("onboarding.activity.introNoDouble"), HcTypeRoles.Body, color = HcColors.TextSecondary)
        }
        "work" -> Question(t.t("onboarding.activity.workQuestion")) {
            WORK_TYPES.forEach { key -> WideChoice(t.t("onboarding.activity.work.$key"), answers.work == key, Modifier.fillMaxWidth(), alignStart = true) { onChange(answers.copy(work = key)) } }
        }
        "walkStand" -> Question(t.t("onboarding.activity.walkStandQuestion"), t.t("onboarding.activity.walkStandHint")) {
            WALK_STAND_HOURS.forEach { key -> WideChoice(t.t("onboarding.activity.walkStand.$key"), answers.walkStand == key, Modifier.fillMaxWidth(), alignStart = true) { onChange(answers.copy(walkStand = key)) } }
        }
        "transport" -> Question(t.t("onboarding.activity.transportQuestion")) {
            TRANSPORT_TYPES.forEach { key -> WideChoice(t.t("onboarding.activity.transport.$key"), answers.transport == key, Modifier.fillMaxWidth(), alignStart = true) { onChange(answers.copy(transport = key)) } }
        }
        "steps" -> Question(t.t("onboarding.activity.stepsQuestion"), t.t("onboarding.activity.stepsHint")) {
            STEP_BANDS.forEach { key ->
                WideChoice(t.t("onboarding.activity.steps.$key"), answers.steps == key, Modifier.fillMaxWidth(), alignStart = true) { onChange(answers.copy(steps = key, stepsMeasured = false)) }
            }
            WideChoice(t.t("onboarding.activity.dontKnow"), answers.steps == null, Modifier.fillMaxWidth(), alignStart = true) { onChange(answers.copy(steps = null, stepsMeasured = false)) }
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                ProfileTextButton(t.t("onboarding.activity.viaIntegration"), onClick = onOpenIntegrations, color = HcColors.TextSecondary)
            }
        }
        "training" -> Question(t.t("onboarding.activity.trainingQuestion"), t.t("onboarding.activity.trainingHint")) {
            HcText(t.t("onboarding.activity.sessionsPerWeek"), HcTypeRoles.Label, color = HcColors.TextSecondary)
            SESSIONS.chunked(4).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { n ->
                        ProfileChoiceChip(if (n == 7) "7+" else n.toString(), training.sessionsPerWeek == n, { setTraining(training.copy(sessionsPerWeek = n)) }, Modifier.weight(1f))
                    }
                }
            }
            if (training.sessionsPerWeek > 0) {
                HcText(t.t("onboarding.activity.sessionMinutes"), HcTypeRoles.Label, color = HcColors.TextSecondary)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MINUTES.forEach { m ->
                        ProfileChoiceChip(if (m == 90) "90+" else m.toString(), training.sessionMinutes == m, { setTraining(training.copy(sessionMinutes = m)) }, Modifier.weight(1f))
                    }
                }
            }
        }
        "intensity" -> Question(t.t("onboarding.activity.intensityQuestion"), t.t("onboarding.activity.intensityHint")) {
            TRAINING_INTENSITIES.forEach { key ->
                WideChoice(t.t("onboarding.activity.intensity.$key"), training.intensity == key, Modifier.fillMaxWidth(), alignStart = true) { setTraining(training.copy(intensity = key)) }
            }
        }
        "goal" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Heading(t.t("energyGoal.title"))
            HcText(t.t("energyGoal.intro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            if (goalUser != null) ProfileEnergyGoalEditor(goalUser, summary, onGoalChange)
            else HcText(t.t("onboarding.activity.calculating"), HcTypeRoles.Body, color = HcColors.TextSecondary)
        }
        else -> {
            // Result: the suggested level, the calculation and the option to correct it.
            val chosen = summary?.level
            val farFromSuggestion = chosen != null && suggestedLevel != null &&
                kotlin.math.abs(ACTIVITY_LEVEL_KEYS.indexOf(chosen) - ACTIVITY_LEVEL_KEYS.indexOf(suggestedLevel)) > 1
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Heading(t.t("onboarding.activity.resultTitle"))
                if (suggestedLevel != null) {
                    HcText(t.t("onboarding.activity.resultSuggested", "level" to t.t("profile.activityLevel.$suggestedLevel.label")), HcTypeRoles.Body, color = HcColors.Black)
                }
                if (summary != null) ProfileEnergyBreakdown(summary) else HcText(t.t("onboarding.activity.calculating"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("onboarding.activity.adjustLevel"), HcTypeRoles.Label, color = HcColors.TextSecondary)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ACTIVITY_LEVEL_KEYS.forEach { level ->
                            ProfileChoiceChip(t.t("profile.activityLevel.$level.short"), chosen == level, { onPickLevel(level) }, Modifier.weight(1f))
                        }
                    }
                    if (chosen != null) HcText(t.t("profile.activityLevel.$chosen.description"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    if (farFromSuggestion) HcText(t.t("onboarding.activity.farFromSuggestion"), HcTypeRoles.Small, color = HcColors.Warning)
                    HcText(t.t("onboarding.activity.stepsAreExamples"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                }
            }
        }
    }
}

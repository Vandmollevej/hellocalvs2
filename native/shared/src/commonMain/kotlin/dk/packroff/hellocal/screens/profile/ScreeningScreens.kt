package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureSlider
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.ProfileCenteredText
import dk.packroff.hellocal.ui.ProfileChoiceChip
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfileProgressStepper
import dk.packroff.hellocal.ui.ProfileSwipeActions
import dk.packroff.hellocal.ui.ProfileTextArea
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch

// Native port of src/app/profile/screenings/** and src/components/screenings/**.

// ---------------------------------------------------------------------------
// Measurement field: buttons, slider, input field or plus/minus.

@Composable
fun ScreeningInput(
    inputType: String,
    scale: String,
    minLabel: String,
    maxLabel: String,
    value: Int?,
    onChange: (Int) -> Unit,
    readOnly: Boolean = false,
) {
    val range = screeningRange(scale)
    val suffix = if (scale == "PERCENT") " %" else ""
    val current = value ?: range.min
    fun clamp(next: Int) = next.coerceIn(range.min, range.max)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when (inputType) {
            "BUTTONS" -> {
                val options = if (scale == "PERCENT") (0..100 step 10).toList() else (range.min..range.max).toList()
                options.chunked(5).forEach { rowOptions ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        rowOptions.forEach { option ->
                            ProfileChoiceChip(
                                label = option.toString(),
                                selected = value == option,
                                onClick = { onChange(option) },
                                modifier = Modifier.weight(1f),
                                enabled = !readOnly,
                            )
                        }
                        repeat(5 - rowOptions.size) { Box(Modifier.weight(1f)) }
                    }
                }
            }
            "SLIDER" -> {
                HcText(if (value == null) "–" else "$value$suffix", HcTypeRoles.PageTitle, Modifier.fillMaxWidth(), align = TextAlign.Center, color = HcColors.Black)
                CaptureSlider(value = current, min = range.min, max = range.max, step = range.step, onChange = { if (!readOnly) onChange(it) })
            }
            "INPUT" -> HcTextField(
                value = value?.toString() ?: "",
                onValueChange = { text -> text.toIntOrNull()?.let { if (!readOnly) onChange(clamp(it)) } },
                placeholder = "${range.min}–${range.max}$suffix",
                keyboardType = KeyboardType.Number,
                standard = true,
            )
            else -> Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                StepperButton("−", enabled = !readOnly && current > range.min) { onChange(clamp(current - range.step)) }
                HcText(if (value == null) "–" else "$value$suffix", HcTypeRoles.PageTitle, Modifier.width(72.dp), align = TextAlign.Center, color = HcColors.Black)
                StepperButton("+", enabled = !readOnly && current < range.max) { onChange(clamp(current + range.step)) }
            }
        }
        if (minLabel.isNotEmpty() || maxLabel.isNotEmpty()) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                HcText(minLabel, HcTypeRoles.Small, color = HcColors.TextSecondary)
                HcText(maxLabel, HcTypeRoles.Small, color = HcColors.TextSecondary, align = TextAlign.End)
            }
        }
    }
}

@Composable
private fun StepperButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.size(48.dp).clip(CircleShape).background(HcColors.Tan).clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { HcText(label, HcTypeRoles.PageTitle, color = if (enabled) HcColors.Black else HcColors.TextSecondary) }
}

// ---------------------------------------------------------------------------
// Fill-in sheet: one question at a time with dots under (also the Tilføj choice).

@Composable
fun ScreeningFillSheet(screenings: List<Screening>, onClose: () -> Unit, onSaved: () -> Unit = {}) {
    val t = LocalTranslator.current
    val active = screenings.filter { it.active }
    var selectedId by remember { mutableStateOf(if (active.size == 1) active[0].id else null) }
    val selected = active.firstOrNull { it.id == selectedId }
    HcBottomSheet(onDismiss = onClose, title = selected?.name ?: t.t("screenings.fillTitle")) {
        if (selected == null) {
            if (active.isEmpty()) {
                HcText(t.t("screenings.fillEmpty"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("screenings.fillPick"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                    active.forEach { screening ->
                        ProfileChoiceChip(screening.name, selected = false, onClick = { selectedId = screening.id }, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        } else {
            ScreeningQuestionnaire(selected, onDone = { onSaved(); onClose() })
        }
    }
}

@Composable
private fun ScreeningQuestionnaire(screening: Screening, onDone: () -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var index by remember { mutableStateOf(0) }
    val answers = remember { mutableMapOf<String, Int>() }
    var answerVersion by remember { mutableStateOf(0) }
    var note by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    val question = screening.questions[index]
    val isLast = index == screening.questions.lastIndex

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (screening.questions.size > 1) {
            HcText(
                t.t("screenings.questionOf").replace("{n}", (index + 1).toString()).replace("{total}", screening.questions.size.toString()),
                HcTypeRoles.Small,
                color = HcColors.TextSecondary,
            )
        }
        HcText(question.text, HcTypeRoles.SectionTitle, color = HcColors.Black)
        // answerVersion makes the field redraw after the map changes.
        key(answerVersion) {
            ScreeningInput(screening.inputType, screening.scale, screening.minLabel, screening.maxLabel, answers[question.id], onChange = {
                answers[question.id] = it
                answerVersion++
            })
        }
        if (isLast && screening.notesEnabled) {
            HcText(t.t("screenings.noteLabel"), HcTypeRoles.Label)
            ProfileTextArea(note, { note = it }, placeholder = t.t("screenings.notePlaceholder"), maxLength = 1000, radius = HcDimens.RadiusCard)
        }
        if (error) HcText(t.t("screenings.saveError"), HcTypeRoles.Small, color = HcColors.RedDark)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (index > 0) HcButton(t.t("screenings.back"), { index-- }, Modifier.weight(1f), kind = HcButtonKind.Secondary)
            if (isLast) {
                HcButton(
                    if (saving) t.t("screenings.saving") else t.t("screenings.saveEntry"),
                    {
                        saving = true
                        error = false
                        scope.launch {
                            val ok = runCatching { ScreeningApi.saveEntry(screening.id, answers.toMap(), note.trim().ifEmpty { null }.takeIf { screening.notesEnabled }) }.isSuccess
                            saving = false
                            if (ok) onDone() else error = true
                        }
                    },
                    Modifier.weight(1f),
                    enabled = !saving && answers.isNotEmpty(),
                )
            } else {
                HcButton(t.t("screenings.next"), { index++ }, Modifier.weight(1f))
            }
        }
        if (screening.questions.size > 1) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                screening.questions.indices.forEach { i ->
                    Box(
                        Modifier.size(8.dp).clip(CircleShape).background(if (i == index) HcColors.Green else HcColors.TanDark).clickable { index = i },
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// /profile/screenings

@Composable
fun ScreeningsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var screenings by remember { mutableStateOf<List<Screening>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<Screening?>(null) }
    var fillOpen by remember { mutableStateOf(args.opt("fill") == "1") }

    LaunchedEffect(Unit) {
        try { screenings = ScreeningApi.load(t) } catch (e: Exception) { failed = true }
    }

    HcScreen(title = t.t("screenings.title"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            HcText(t.t("screenings.intro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            Row(
                Modifier.clickable { nav.push("/profile/screenings/new") },
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                HcIcon("Plus", size = 20.dp, color = HcColors.Black)
                HcText(t.t("screenings.createNew"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
            }
            val list = screenings
            when {
                list == null && !failed -> HcLoader()
                list == null -> ProfileCenteredText(t.t("screenings.loadError"))
                else -> {
                    HcCard(Modifier.fillMaxWidth()) {
                        // Sleep is a fixed row that points at the sleep pattern.
                        Row(
                            Modifier.fillMaxWidth().clickable { nav.push("/profile/sleep") }.padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(10.dp).clip(CircleShape).background(HcColors.Green))
                            HcIcon("Moon", size = 20.dp, color = HcColors.Black)
                            HcText(t.t("screenings.sleep"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                            HcText(t.t("screenings.statusActive"), HcTypeRoles.Small, color = HcColors.GreenDark)
                        }
                        list.forEach { screening ->
                            ProfileSwipeActions(
                                firstLabel = if (screening.active) t.t("screenings.deactivate") else t.t("screenings.activate"),
                                onFirst = {
                                    screenings = list.map { if (it.id == screening.id) it.copy(active = !it.active) else it }
                                    scope.launch { runCatching { ScreeningApi.setActive(screening.id, !screening.active) } }
                                },
                                secondLabel = t.t("screenings.delete"),
                                onSecond = { pendingDelete = screening },
                            ) {
                                Row(
                                    Modifier.fillMaxWidth().background(HcColors.Cream).clickable { nav.push("/profile/screenings/${screening.id}") }.padding(vertical = 12.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(Modifier.size(10.dp).clip(CircleShape).background(if (screening.active) HcColors.Green else HcColors.TanDark))
                                    HcText(screening.name, HcTypeRoles.Body, Modifier.weight(1f), color = if (screening.active) HcColors.Black else HcColors.TextSecondary)
                                    HcText(
                                        if (screening.active) t.t("screenings.statusActive") else t.t("screenings.statusInactive"),
                                        HcTypeRoles.Small,
                                        color = if (screening.active) HcColors.GreenDark else HcColors.TextSecondary,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            HcButton(t.t("screenings.reports"), { nav.push("/profile/screenings/reports") }, kind = HcButtonKind.Secondary)
        }
    }

    val list = screenings
    if (fillOpen && list != null) {
        ScreeningFillSheet(list, onClose = { fillOpen = false }, onSaved = {})
    }
    pendingDelete?.let { target ->
        HcBottomSheet(onDismiss = { pendingDelete = null }, title = t.t("screenings.deleteTitle")) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(t.t("screenings.deleteBody"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                HcButton(
                    t.t("screenings.delete"),
                    {
                        pendingDelete = null
                        screenings = screenings?.filter { it.id != target.id }
                        scope.launch { runCatching { ScreeningApi.delete(target.id) } }
                    },
                    kind = HcButtonKind.Danger,
                )
                HcButton(t.t("screenings.back"), { pendingDelete = null }, kind = HcButtonKind.Secondary)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// /profile/screenings/new and /profile/screenings/[id]: the creation flow.

private val FLOW_STEPS = listOf("stepName", "stepFrequency", "stepQuestions", "stepNotifications", "stepMeasure", "stepCalendar")
private var questionCounter = 0
private fun newQuestionId(): String = "q${questionCounter++}x${(0..9999).random()}"

@Composable
fun ScreeningNewScreen(args: RouteArgs) = ScreeningFlowScreen(null)

@Composable
fun ScreeningEditScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    var existing by remember { mutableStateOf<Screening?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(args["id"]) {
        try {
            existing = ScreeningApi.load(t).firstOrNull { it.id == args["id"] }
            if (existing == null) failed = true
        } catch (e: Exception) { failed = true }
    }
    val current = existing
    if (current != null) ScreeningFlowScreen(current)
    else HcScreen(title = t.t("screenings.editTitle"), contentPadding = ProfilePagePadding) {
        if (failed) ProfileCenteredText(t.t("screenings.loadError")) else HcLoader()
    }
}

@Composable
private fun ScreeningFlowScreen(existing: Screening?) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(0) }
    var draft by remember {
        mutableStateOf(
            existing?.copy(notificationTime = existing.notificationTime ?: "20:00")
                ?: Screening(
                    id = "", presetKey = null, name = "", purpose = "", frequency = "DAILY",
                    questions = listOf(ScreeningQuestion(newQuestionId(), "")),
                    notificationsEnabled = false, notificationTime = "20:00", scale = "TEN", inputType = "SLIDER",
                    notesEnabled = true, minLabel = "", maxLabel = "", showInCalendar = false, active = true,
                ),
        )
    }
    var previewValue by remember { mutableStateOf<Int?>(null) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    val last = step == FLOW_STEPS.lastIndex
    val canContinue = when (step) {
        0 -> draft.name.isNotBlank()
        2 -> draft.questions.any { it.text.isNotBlank() }
        else -> true
    }

    HcScreen(
        title = if (existing != null) t.t("screenings.editTitle") else t.t("screenings.newTitle"),
        contentPadding = ProfilePagePadding,
        onBack = { if (step == 0) nav.backOrHome() else step-- },
        bottom = {
            if (error) HcText(t.t("screenings.saveError"), HcTypeRoles.Small, Modifier.fillMaxWidth(), align = TextAlign.Center, color = HcColors.RedDark)
            HcButton(
                if (last) (if (saving) t.t("screenings.saving") else t.t("screenings.save")) else t.t("screenings.next"),
                {
                    if (!last) step++ else {
                        saving = true
                        error = false
                        scope.launch {
                            val ok = runCatching { ScreeningApi.save(existing?.id, draft) }.isSuccess
                            saving = false
                            if (ok) nav.replace("/profile/screenings") else error = true
                        }
                    }
                },
                enabled = canContinue && !saving,
            )
        },
    ) {
        ProfilePage {
            ProfileProgressStepper(FLOW_STEPS.map { t.t("screenings.$it") }, step, 0f)
            when (step) {
                0 -> {
                    HcToggle(
                        draft.active, { draft = draft.copy(active = it) },
                        if (draft.active) t.t("screenings.statusActive") else t.t("screenings.statusInactive"),
                        t.t("screenings.activeDesc"),
                    )
                    HcText(t.t("screenings.nameTitle"), HcTypeRoles.SectionTitle)
                    HcTextField(draft.name, { draft = draft.copy(name = it.take(60)) }, placeholder = t.t("screenings.namePlaceholder"), label = t.t("screenings.nameLabel"), standard = true)
                    HcText(t.t("screenings.purposeLabel"), HcTypeRoles.Label)
                    ProfileTextArea(draft.purpose, { draft = draft.copy(purpose = it) }, placeholder = t.t("screenings.purposePlaceholder"), maxLength = 300, radius = HcDimens.RadiusCard)
                }
                1 -> {
                    HcText(t.t("screenings.frequencyTitle"), HcTypeRoles.SectionTitle)
                    SCREENING_FREQUENCIES.forEach { key ->
                        ProfileChoiceChip(t.t("screenings.frequency.$key"), draft.frequency == key, { draft = draft.copy(frequency = key) }, Modifier.fillMaxWidth())
                    }
                }
                2 -> {
                    HcText(t.t("screenings.questionsTitle"), HcTypeRoles.SectionTitle)
                    draft.questions.forEachIndexed { i, question ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                            HcTextField(
                                question.text,
                                { text -> draft = draft.copy(questions = draft.questions.map { if (it.id == question.id) it.copy(text = text.take(200)) else it }) },
                                Modifier.weight(1f),
                                placeholder = t.t("screenings.questionPlaceholder"),
                                label = t.t("screenings.questionLabel").replace("{n}", (i + 1).toString()),
                                standard = true,
                            )
                            if (draft.questions.size > 1) {
                                Box(
                                    Modifier.size(48.dp).clickable { draft = draft.copy(questions = draft.questions.filter { it.id != question.id }) },
                                    contentAlignment = Alignment.Center,
                                ) { HcIcon("Trash", size = 20.dp, color = HcColors.RedDark) }
                            }
                        }
                    }
                    if (draft.questions.size < SCREENING_MAX_QUESTIONS) {
                        Row(
                            Modifier.clickable { draft = draft.copy(questions = draft.questions + ScreeningQuestion(newQuestionId(), "")) },
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            HcIcon("Plus", size = 20.dp, color = HcColors.Black)
                            HcText(t.t("screenings.addQuestion"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                        }
                    }
                }
                3 -> {
                    HcText(t.t("screenings.notifTitle"), HcTypeRoles.SectionTitle)
                    HcToggle(draft.notificationsEnabled, { draft = draft.copy(notificationsEnabled = it) }, t.t("screenings.notifLabel"), t.t("screenings.notifDesc"))
                    if (draft.notificationsEnabled) {
                        HcTextField(draft.notificationTime ?: "20:00", { draft = draft.copy(notificationTime = it.take(5)) }, label = t.t("screenings.notifTime"), placeholder = "20:00", standard = true)
                    }
                }
                4 -> {
                    HcText(t.t("screenings.measureTitle"), HcTypeRoles.SectionTitle)
                    HcText(t.t("screenings.scaleTitle"), HcTypeRoles.Label)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SCREENING_SCALES.forEach { key ->
                            ProfileChoiceChip(t.t("screenings.scale.$key"), draft.scale == key, { draft = draft.copy(scale = key); previewValue = null }, Modifier.weight(1f))
                        }
                    }
                    HcText(t.t("screenings.inputTitle"), HcTypeRoles.Label)
                    // Every choice shows what it looks like; tap to select.
                    SCREENING_INPUT_TYPES.forEach { key ->
                        val selected = draft.inputType == key
                        HcCard(
                            Modifier.fillMaxWidth().background(if (selected) HcColors.GreenLight else HcColors.Cream, RoundedCornerShape(HcDimens.RadiusCard)),
                            onClick = { draft = draft.copy(inputType = key) },
                        ) {
                            HcText(t.t("screenings.input.$key"), HcTypeRoles.Small, color = HcColors.Black)
                            ScreeningInput(key, draft.scale, draft.minLabel, draft.maxLabel, previewValue, { previewValue = it }, readOnly = true)
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HcTextField(draft.minLabel, { draft = draft.copy(minLabel = it.take(30)) }, Modifier.weight(1f), placeholder = t.t("screenings.minPlaceholder"), label = t.t("screenings.minLabel"), standard = true)
                        HcTextField(draft.maxLabel, { draft = draft.copy(maxLabel = it.take(30)) }, Modifier.weight(1f), placeholder = t.t("screenings.maxPlaceholder"), label = t.t("screenings.maxLabel"), standard = true)
                    }
                    HcToggle(draft.notesEnabled, { draft = draft.copy(notesEnabled = it) }, t.t("screenings.notesLabel"), t.t("screenings.notesDesc"))
                }
                else -> {
                    HcText(t.t("screenings.calendarTitle"), HcTypeRoles.SectionTitle)
                    HcToggle(draft.showInCalendar, { draft = draft.copy(showInCalendar = it) }, t.t("screenings.calendarLabel"), t.t("screenings.calendarDesc"))
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// /profile/screenings/reports and /profile/screenings/reports/[id]

@Composable
fun ScreeningReportsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var screenings by remember { mutableStateOf<List<Screening>?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try { screenings = ScreeningApi.load(t) } catch (e: Exception) { failed = true }
    }
    HcScreen(title = t.t("screenings.reportsTitle"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            val list = screenings
            when {
                list == null && !failed -> HcLoader()
                list == null -> ProfileCenteredText(t.t("screenings.loadError"))
                else -> HcCard(Modifier.fillMaxWidth()) {
                    // Sleep is a fixed row that points at the sleep statistics.
                    Row(
                        Modifier.fillMaxWidth().clickable { nav.push("/statistics/sleep") }.padding(vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                            HcIcon("Moon", size = 22.dp, color = HcColors.Black)
                        }
                        Column(Modifier.weight(1f)) {
                            HcText(t.t("screenings.sleep"), HcTypeRoles.Body, color = HcColors.Black, maxLines = 2)
                            HcText(t.t("screenings.statusActive"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        }
                        HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black)
                    }
                    list.forEach { screening ->
                        // Same look as a food row: tile on the left, title and status, chevron.
                        Row(
                            Modifier.fillMaxWidth().clickable { nav.push("/profile/screenings/reports/${screening.id}") }.padding(vertical = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                                HcIcon("ClipboardHeart", size = 22.dp, color = HcColors.Black)
                            }
                            Column(Modifier.weight(1f)) {
                                HcText(screening.name, HcTypeRoles.Body, color = HcColors.Black, maxLines = 2)
                                HcText(
                                    if (screening.active) t.t("screenings.statusActive") else t.t("screenings.statusInactive"),
                                    HcTypeRoles.Small, color = HcColors.TextSecondary,
                                )
                            }
                            HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ScreeningReportScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    var screening by remember { mutableStateOf<Screening?>(null) }
    val entries = remember { mutableStateListOf<ScreeningEntry>() }
    var loaded by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var sortByValue by remember { mutableStateOf(false) }
    var descending by remember { mutableStateOf(true) }
    var sortOpen by remember { mutableStateOf(false) }

    LaunchedEffect(args["id"]) {
        try {
            screening = ScreeningApi.load(t).firstOrNull { it.id == args["id"] }
            entries.clear()
            entries.addAll(ScreeningApi.entries(args["id"]))
            loaded = true
        } catch (e: Exception) { failed = true }
    }

    HcScreen(title = screening?.name ?: t.t("screenings.reportsTitle"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            val current = screening
            when {
                failed -> ProfileCenteredText(t.t("screenings.loadError"))
                !loaded || current == null -> HcLoader()
                entries.isEmpty() -> HcText(t.t("screenings.noEntries"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                else -> {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) {
                            Row(
                                Modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(RoundedCornerShape(12.dp)).background(HcColors.White)
                                    .clickable { sortOpen = true }.padding(horizontal = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                HcText(if (sortByValue) t.t("screenings.sortValue") else t.t("screenings.sortDate"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                                HcIcon("ChevronDown", size = 14.dp, color = HcColors.Black)
                            }
                            DropdownMenu(expanded = sortOpen, onDismissRequest = { sortOpen = false }) {
                                DropdownMenuItem(text = { HcText(t.t("screenings.sortDate"), HcTypeRoles.Body) }, onClick = { sortByValue = false; sortOpen = false })
                                DropdownMenuItem(text = { HcText(t.t("screenings.sortValue"), HcTypeRoles.Body) }, onClick = { sortByValue = true; sortOpen = false })
                            }
                        }
                        Box(
                            Modifier.size(HcDimens.ControlHeight).clip(RoundedCornerShape(12.dp)).background(HcColors.White).clickable { descending = !descending },
                            contentAlignment = Alignment.Center,
                        ) { HcIcon(if (descending) "ArrowDown" else "ArrowUp", size = 20.dp, color = HcColors.Black) }
                    }
                    val sorted = entries.sortedWith(
                        if (sortByValue) compareBy<ScreeningEntry>({ it.value }, { it.date }) else compareBy { it.date },
                    ).let { if (descending) it.reversed() else it }
                    HcCard(Modifier.fillMaxWidth()) {
                        sorted.forEach { entry ->
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 10.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                                    HcText(formatScreeningValue(entry.value, "TEN"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                                }
                                Column(Modifier.weight(1f)) {
                                    HcText(entry.date, HcTypeRoles.Body, color = HcColors.Black)
                                    HcText(entry.note ?: formatScreeningValue(entry.value, current.scale), HcTypeRoles.Small, color = HcColors.TextSecondary, maxLines = 2)
                                }
                                if (entry.note != null) HcIcon("Note", size = 20.dp, color = HcColors.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}

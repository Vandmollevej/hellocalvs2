package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.ui.FieldSlider
import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.HeightUnit
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.Device
import dk.packroff.hellocal.platform.DevicePermissionDenied
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileBrandCard
import dk.packroff.hellocal.ui.ProfileFilledField
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Serializable
data class BodyMeasurementEntry(
    val id: String,
    val waistCm: Double? = null,
    val hipCm: Double? = null,
    val chestCm: Double? = null,
    val thighCm: Double? = null,
    val upperArmCm: Double? = null,
    val neckCm: Double? = null,
    val buttockCm: Double? = null,
    val ankleCm: Double? = null,
    val calfCm: Double? = null,
    val measuredAt: String,
) {
    fun value(field: String): Double? = when (field) {
        "waistCm" -> waistCm
        "hipCm" -> hipCm
        "chestCm" -> chestCm
        "thighCm" -> thighCm
        "upperArmCm" -> upperArmCm
        "buttockCm" -> buttockCm
        "ankleCm" -> ankleCm
        "calfCm" -> calfCm
        else -> null
    }
}

/**
 * src/lib/stat-charts.ts addChartsToLayout: puts the body-measurement charts
 * at the bottom of Statistik's charts (same storage key as the web's localStorage).
 */
private fun addBodyChartsToStatistics() {
    val key = "hellocal.statistik.charts"
    val wanted = BODY_MEASUREMENT_FIELDS.map { "body:${it.field}" }
    runCatching {
        val stored = NativeHooks.secureStorage.get(key)?.let { runCatching { Json.parseToJsonElement(it) as? JsonArray }.getOrNull() }
        // Without a stored layout Statistik shows DEFAULT_ACTIVE_CHART_KEYS — start from those.
        val current = stored?.mapNotNull { (it as? JsonPrimitive)?.content } ?: listOf("caloriesAndWeight", "intradayKcal", "sleepQuality")
        val next = current + wanted.filter { it !in current }
        NativeHooks.secureStorage.set(key, JsonArray(next.map { JsonPrimitive(it) }).toString())
    }
}

/** Native port of src/app/profile/body-measurements/page.tsx. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BodyMeasurementsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val lengthUnit = remember { Units.current().height }
    var entries by remember { mutableStateOf<List<BodyMeasurementEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    val values = remember { mutableStateMapOf<String, String>() }
    // Today's row (if any) — several field edits on the same day are collected in this one row.
    var todaysEntryId by remember { mutableStateOf<String?>(null) }
    // Sex only decides which drawings are shown; without a chosen sex no drawing is guessed.
    var sex by remember { mutableStateOf<String?>(null) }
    var sexLoaded by remember { mutableStateOf(false) }
    // Which measurements the user chose to show (Indstillinger → Visning → Kropsmål).
    var visibility by remember { mutableStateOf<Map<String, Boolean>?>(null) }

    suspend fun load() {
        try {
            val list = (Api.get("/api/body-measurements") as JsonObject)["entries"] ?: JsonArray(emptyList())
            val loaded = ApiJson.decodeFromJsonElement(ListSerializer(BodyMeasurementEntry.serializer()), list)
            entries = loaded
            val today = loaded.firstOrNull { ProfileDates.isSameLocalDay(it.measuredAt, ProfileDates.today()) }
            todaysEntryId = today?.id
            values.clear()
            BODY_MEASUREMENT_FIELDS.forEach { field ->
                val cm = today?.value(field.field)
                values[field.field] = if (cm == null) "" else jsNumber(if (lengthUnit == HeightUnit.In) round1(Units.cmToIn(cm)) else cm)
            }
        } catch (e: Exception) {
            entries = emptyList()
        }
        loading = false
    }

    LaunchedEffect(Unit) {
        runCatching { ProfileApi.loadUser() }.getOrNull()?.let {
            sex = it.sex
            visibility = it.bodyMeasurementVisibility
            sexLoaded = true
        }
    }
    LaunchedEffect(Unit) { load() }

    fun commitField(field: String) {
        val raw = values[field] ?: ""
        val typed = if (raw.isBlank()) null else raw.replaceFirst(",", ".").toDoubleOrNull() ?: 0.0
        if (typed != null && typed <= 0) return
        // Typed in the chosen unit, always saved in cm.
        val parsed = typed?.let { if (lengthUnit == HeightUnit.In) round1(Units.inToCm(it)) else it }
        scope.launch {
            saving = true
            try {
                val todayId = todaysEntryId
                if (todayId != null) {
                    runCatching { Api.patch("/api/body-measurements/$todayId", mapOf(field to parsed)) }.onSuccess {
                        NativeHooks.onRegistrationChanged()
                        load()
                    }
                } else if (parsed != null) {
                    runCatching { Api.post("/api/body-measurements", mapOf(field to parsed)) }.onSuccess { response ->
                        ((response as? JsonObject)?.get("entry") as? JsonObject)?.get("id")?.let { todaysEntryId = (it as? JsonPrimitive)?.content }
                        NativeHooks.onRegistrationChanged()
                        load()
                    }
                }
            } finally {
                saving = false
            }
        }
    }

    val visibleFields = BODY_MEASUREMENT_FIELDS.filter { visibility?.get(it.field) != false }

    // --- Voice guide (src/components/body-measurements/useBodyMeasurementVoice.ts) ---
    // Fills ONLY the body-measurement fields: the number goes into the field and is
    // saved exactly like typing it.
    var voiceJob by remember { mutableStateOf<Job?>(null) }
    var voicePhase by remember { mutableStateOf("idle") }
    var voiceField by remember { mutableStateOf<String?>(null) }
    var voiceSpoken by remember { mutableStateOf("") }
    var voiceHeard by remember { mutableStateOf("") }
    var voiceError by remember { mutableStateOf<String?>(null) }
    val requesters = remember { mutableMapOf<String, BringIntoViewRequester>() }

    fun lineText(line: VoiceLine, inches: Boolean): String = t.t(
        "bodyMeasurements.voice.${line.key}",
        mapOf(
            "target" to (line.field?.let { t.t("bodyMeasurements.voice.target.$it") } ?: ""),
            "value" to (line.value?.let { BodyMeasurementVoice.spokenValue(it, t.locale.code) } ?: ""),
            "unit" to t.t(if (inches) "bodyMeasurements.voice.unitIn" else "bodyMeasurements.voice.unitCm"),
        ),
    )

    fun stopVoice() {
        voiceJob?.cancel()
        voiceJob = null
        voicePhase = "idle"
        voiceField = null
    }

    fun startVoice() {
        val fields = visibleFields.map { it.field }
        val inches = lengthUnit == HeightUnit.In
        val tag = BodyMeasurementVoice.languageTag(t.locale.code)
        voiceError = null
        voiceHeard = ""
        var job: Job? = null
        job = scope.launch {
            var step = BodyMeasurementVoice.start(fields, BodyMeasurementVoice.firstIndex(fields) { !values[it].isNullOrBlank() })
            try {
                while (true) {
                    step.save?.let { save ->
                        values[save.field] = jsNumber(save.value)
                        commitField(save.field)
                    }
                    voiceField = if (step.done) null else step.state.fields.getOrNull(step.state.index)
                    val text = step.say.joinToString(" ") { lineText(it, inches) }
                    voiceSpoken = text
                    voicePhase = "speaking"
                    Device.speak(text, tag)
                    if (step.done) break
                    voicePhase = "listening"
                    voiceHeard = ""
                    val heard = Device.recognizeSpeech(tag) { voiceHeard = it.trim() }
                    voiceHeard = heard ?: ""
                    step = BodyMeasurementVoice.step(step.state, heard, inches)
                }
            } catch (e: DevicePermissionDenied) {
                voiceError = t.t("bodyMeasurements.voice.micDenied")
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                voiceError = t.t("bodyMeasurements.voice.unsupported")
            } finally {
                if (voiceJob === job) {
                    voiceJob = null
                    voicePhase = "idle"
                    voiceField = null
                }
            }
        }
        voiceJob = job
    }

    // The current measurement is scrolled into view, so the drawing and the field are visible.
    LaunchedEffect(voiceField) {
        voiceField?.let { requesters[it]?.bringIntoView() }
    }

    fun remove(id: String) {
        entries = entries.filter { it.id != id }
        if (todaysEntryId == id) todaysEntryId = null
        scope.launch {
            runCatching { Api.delete("/api/body-measurements/$id") }
            NativeHooks.onRegistrationChanged()
        }
    }

    HcScreen(title = t.t("bodyMeasurements.title"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            if (Device.available) {
                val cardShape = RoundedCornerShape(HcDimens.RadiusCard)
                val active = voicePhase != "idle"
                Column(
                    Modifier.fillMaxWidth().clip(cardShape).background(HcColors.Card, cardShape).padding(HcDimens.SpaceBlock),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            Modifier.size(56.dp).clip(CircleShape).clickable { if (active) stopVoice() else startVoice() },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (voicePhase == "listening") Box(Modifier.size(56.dp).clip(CircleShape).background(HcColors.Green.copy(alpha = 0.2f)))
                            Box(Modifier.size(if (voicePhase == "listening") 48.dp else 56.dp).clip(CircleShape).background(HcColors.Black), contentAlignment = Alignment.Center) {
                                if (active) {
                                    HcIcon("PlayerStopFilled", size = 22.dp, color = HcColors.White, contentDescription = t.t("bodyMeasurements.voice.stop"))
                                } else {
                                    HcIcon("Microphone", size = 28.dp, stroke = 1.8f, color = HcColors.White, contentDescription = t.t("bodyMeasurements.voice.start"))
                                }
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            HcText(
                                when (voicePhase) {
                                    "listening" -> t.t("bodyMeasurements.voice.listening")
                                    "speaking" -> t.t("bodyMeasurements.voice.speaking")
                                    else -> t.t("bodyMeasurements.voice.start")
                                },
                                HcTypeRoles.Body,
                                bold = true,
                                color = HcColors.Black,
                            )
                            HcText(
                                if (active && voiceSpoken.isNotEmpty()) voiceSpoken else t.t("bodyMeasurements.voice.startHint"),
                                HcTypeRoles.Small,
                                color = HcColors.TextSecondary,
                            )
                        }
                    }
                    if (active && voiceHeard.isNotEmpty()) {
                        HcText(t.t("bodyMeasurements.voice.youSaid", "text" to voiceHeard), HcTypeRoles.Small, bold = true, color = HcColors.Black)
                    }
                    voiceError?.let { HcText(it, HcTypeRoles.Small, color = HcColors.RedDark) }
                }
            }
            ProfileBrandCard(t.t("bodyMeasurements.intro"))
            if (sexLoaded && sex == null) {
                HcText(t.t("bodyMeasurements.chooseSexHint"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            // One card per measurement: drawing on the left in fixed width, title and field on one line to the right.
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                visibleFields.forEach { field ->
                    val shape = RoundedCornerShape(HcDimens.RadiusCard)
                    val requester = requesters.getOrPut(field.field) { BringIntoViewRequester() }
                    val highlight = if (voiceField == field.field) Modifier.border(2.dp, HcColors.Green, shape) else Modifier
                    Row(
                        Modifier.fillMaxWidth().bringIntoViewRequester(requester).clip(shape).background(HcColors.Card, shape).then(highlight).padding(HcDimens.SpaceBlock),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(Modifier.width(80.dp).height(108.dp), contentAlignment = Alignment.Center) {
                            val currentSex = sex
                            if (field.drawing != null && currentSex != null) {
                                val prefix = if (currentSex == "FEMALE") "female" else "male"
                                HcRemoteImage("/body-measurements/$prefix-${field.drawing}.png", Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                            }
                        }
                        Column(Modifier.weight(1f)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            HcText(t.t(field.labelKey), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ProfileFilledField(
                                    values[field.field] ?: "",
                                    { values[field.field] = it },
                                    Modifier.width(80.dp),
                                    placeholder = t.t("bodyMeasurements.placeholder"),
                                    keyboardType = KeyboardType.Decimal,
                                    onCommit = { commitField(field.field) },
                                    role = HcTypeRoles.Title,
                                    background = HcColors.Card,
                                    textAlign = TextAlign.End,
                                    minHeight = 32.dp,
                                )
                                HcText(Units.lengthUnitLabel(lengthUnit), HcTypeRoles.Body, color = HcColors.TextSecondary)
                            }
                        }
                        FieldSlider(
                            values[field.field] ?: "",
                            if (lengthUnit == HeightUnit.In) 4.0 else 10.0,
                            if (lengthUnit == HeightUnit.In) 100.0 else 250.0,
                            { values[field.field] = it; commitField(field.field) },
                            step = 0.5,
                        )
                        }
                    }
                }
            }
            // Puts the body-measurement charts at the bottom of Statistik's charts and opens it.
            HcText(
                t.t("bodyMeasurementChart.showInStats"),
                HcTypeRoles.Small,
                Modifier.fillMaxWidth().clickable {
                    addBodyChartsToStatistics()
                    nav.push("/statistics")
                },
                bold = true,
                underline = true,
                color = HcColors.Black,
                align = TextAlign.Center,
            )
            if (saving) HcText(t.t("bodyMeasurements.saving"), HcTypeRoles.Micro, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (loading) HcLoader()
                if (!loading && entries.isEmpty()) {
                    HcText(t.t("bodyMeasurements.noEntriesYet"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                entries.forEach { entry ->
                    val shape = RoundedCornerShape(16.dp)
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(shape).background(HcColors.Tan, shape).padding(start = 16.dp, top = 8.dp, bottom = 8.dp, end = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        val summary = BODY_MEASUREMENT_FIELDS.mapNotNull { field ->
                            entry.value(field.field)?.let { "${t.t(field.labelKey)}: ${Units.formatLength(it, lengthUnit)}" }
                        }.joinToString(" · ")
                        Column(Modifier.weight(1f)) {
                            HcText(summary, HcTypeRoles.Small, bold = true, color = HcColors.Black)
                            HcText(ProfileDates.dayMonthTime(entry.measuredAt), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        }
                        Box(Modifier.heightIn(min = 44.dp).clickable { remove(entry.id) }.padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
                            HcText(t.t("bodyMeasurements.delete"), HcTypeRoles.Small, bold = true, color = HcColors.TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

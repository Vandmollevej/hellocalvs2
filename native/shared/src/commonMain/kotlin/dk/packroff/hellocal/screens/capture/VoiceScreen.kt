package dk.packroff.hellocal.screens.capture

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureDetailRow
import dk.packroff.hellocal.ui.CaptureEntryDetailsSheet
import dk.packroff.hellocal.ui.CaptureFilledField
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.CaptureSwipeableRow
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.PI
import kotlin.math.roundToInt
import kotlin.math.sin

/** A suggestion (saved = false) or a saved registration (id = registration id). */
@Serializable
internal data class VoiceItem(val id: String, val item: InterpretedItem, val saved: Boolean, val batch: Int = 0)

@Serializable
private data class PersistedVoiceItems(val date: String, val items: List<VoiceItem>)

private enum class VoicePhase { Idle, Listening, Processing, Added, Error, Unsupported }

private const val VOICE_ITEMS_STORAGE_KEY = "hf-voice-added-items"

private fun todayKey() = CaptureDates.isoDate(CaptureDates.today())

/** Items saved earlier today survive navigating away and back; older ones are dropped. */
private fun loadPersistedItems(): List<VoiceItem> {
    val raw = NativeHooks.secureStorage.get(VOICE_ITEMS_STORAGE_KEY) ?: return emptyList()
    val parsed = runCatching { ApiJson.decodeFromString(PersistedVoiceItems.serializer(), raw) }.getOrNull() ?: return emptyList()
    if (parsed.date != todayKey()) {
        NativeHooks.secureStorage.set(VOICE_ITEMS_STORAGE_KEY, null)
        return emptyList()
    }
    return parsed.items
}

private fun persist(items: List<VoiceItem>) {
    val saved = items.filter { it.saved }
    NativeHooks.secureStorage.set(
        VOICE_ITEMS_STORAGE_KEY,
        if (saved.isEmpty()) null else ApiJson.encodeToString(PersistedVoiceItems.serializer(), PersistedVoiceItems(todayKey(), saved)),
    )
}

private var pendingCounter = 0

private fun mapInterpreted(list: List<InterpretedItem>, batch: Int): List<VoiceItem> =
    list.map { VoiceItem("pending-$batch-${pendingCounter++}", it, saved = false, batch = batch) }

/** Everything that is not a suggestion from [batch]: saved rows and other recordings' suggestions. */
private fun keepOther(items: List<VoiceItem>, batch: Int) = items.filter { it.saved || it.batch != batch }

/** Native port of src/app/voice/page.tsx. */
@Composable
fun VoiceScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val lang = rememberMealInputLanguage()
    val initial = remember { loadPersistedItems() }
    var items by remember { mutableStateOf(initial) }
    var phase by remember { mutableStateOf(if (initial.isNotEmpty()) VoicePhase.Added else VoicePhase.Idle) }
    var transcript by remember { mutableStateOf("") }
    var finalTranscript by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf<VoiceItem?>(null) }
    var isAdding by remember { mutableStateOf(false) }
    var batch by remember { mutableStateOf(0) }
    var session by remember { mutableStateOf<Job?>(null) }
    var liveRequest by remember { mutableStateOf(0) }

    fun updateItems(next: List<VoiceItem>) {
        items = next
        persist(next)
    }

    suspend fun finishProcessing(spoken: String, currentBatch: Int) {
        phase = VoicePhase.Processing
        val text = spoken.trim()
        if (text.isEmpty()) {
            val remaining = keepOther(items, currentBatch)
            updateItems(remaining)
            phase = if (remaining.any { it.saved }) VoicePhase.Added else if (remaining.isNotEmpty()) VoicePhase.Idle else VoicePhase.Error
            if (remaining.isEmpty()) errorMessage = t.t("voice.error.noSpeech")
            return
        }
        try {
            val data = ApiJson.decodeFromJsonElement(
                InterpretedResponse.serializer(),
                Api.post("/api/ai/interpret-meal", mapOf("transcript" to text, "language" to lang.language)),
            )
            val interpreted = mapInterpreted(data.items, currentBatch)
            val others = keepOther(items, currentBatch)
            if (interpreted.isEmpty()) {
                updateItems(others)
                phase = if (others.any { it.saved }) VoicePhase.Added else if (others.isNotEmpty()) VoicePhase.Idle else VoicePhase.Error
                if (others.isEmpty()) errorMessage = t.t("voice.error.noFoodRecognized")
                return
            }
            updateItems(others + interpreted)
            phase = VoicePhase.Idle
            errorMessage = null
        } catch (e: Exception) {
            updateItems(keepOther(items, currentBatch))
            phase = VoicePhase.Error
            errorMessage = t.t("voice.error.aiInterpretFailed")
        }
    }

    fun startListening() {
        val record = CaptureHooks.recordSpeech
        if (record == null) {
            phase = VoicePhase.Unsupported
            return
        }
        // A new recording = a new batch of suggestions; earlier suggestions stay.
        batch += 1
        val currentBatch = batch
        finalTranscript = ""
        transcript = ""
        errorMessage = null
        phase = VoicePhase.Listening
        val tag = MealInputLanguages.speechLangFor(lang.language, lang.region)
        var job: Job? = null
        job = scope.launch {
            try {
                val result = record(tag) { partial -> if (session == job) transcript = partial.trim() }
                if (session != job) return@launch
                session = null
                finalTranscript = result ?: transcript
                transcript = finalTranscript.trim()
                finishProcessing(finalTranscript, currentBatch)
            } catch (e: CapturePermissionDenied) {
                if (session != job) return@launch
                session = null
                phase = VoicePhase.Error
                errorMessage = t.t("voice.error.micDenied")
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                if (session != job) return@launch
                session = null
                phase = VoicePhase.Error
                errorMessage = t.t("voice.error.recognitionInterrupted")
            }
        }
        session = job
    }

    fun stopListening() {
        if (session == null) return
        phase = VoicePhase.Processing
        CaptureHooks.stopSpeech()
    }

    // Starting over aborts the current session outright before starting a new one.
    fun restartListening() {
        val old = session
        session = null
        old?.cancel()
        CaptureHooks.stopSpeech()
        startListening()
    }

    // Exactly one recognition session is started on open.
    LaunchedEffect(Unit) { startListening() }

    // Live interpretation of what has been said so far (700 ms after the last change).
    LaunchedEffect(transcript, phase) {
        if (phase != VoicePhase.Listening || transcript.isBlank()) return@LaunchedEffect
        delay(700)
        val requestId = ++liveRequest
        val currentBatch = batch
        runCatching {
            ApiJson.decodeFromJsonElement(
                InterpretedResponse.serializer(),
                Api.post("/api/ai/interpret-meal", mapOf("transcript" to transcript, "language" to lang.language)),
            )
        }.getOrNull()?.let { data ->
            if (requestId != liveRequest || phase != VoicePhase.Listening) return@let
            updateItems(keepOther(items, currentBatch) + mapInterpreted(data.items, currentBatch))
        }
    }

    // Nothing is saved without the user asking (docs/AI.md).
    fun addItems(pending: List<VoiceItem>) {
        if (pending.isEmpty()) return
        isAdding = true
        errorMessage = null
        scope.launch {
            val results = coroutineScope {
                pending.map { entry ->
                    async {
                        runCatching {
                            val res = Api.post("/api/registrations", registrationBody(entry.item)).jsonObject
                            val id = res["registration"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: return@runCatching null
                            entry.copy(id = id, saved = true)
                        }.getOrNull()
                    }
                }.awaitAll()
            }
            val newlySaved = results.filterNotNull()
            val pendingIds = pending.map { it.id }.toSet()
            updateItems(items.filter { it.id !in pendingIds } + newlySaved)
            isAdding = false
            if (newlySaved.isNotEmpty()) NativeHooks.onRegistrationChanged()
            if (newlySaved.isEmpty()) {
                phase = VoicePhase.Error
                errorMessage = t.t("voice.error.couldNotSaveRegistrations")
            } else {
                phase = VoicePhase.Added
                if (newlySaved.size < pending.size) errorMessage = t.t("voice.error.couldNotSaveRegistrations")
            }
        }
    }

    fun deleteItem(entry: VoiceItem) {
        if (entry.saved) {
            confirmDelete = entry
            return
        }
        updateItems(items.filter { it.id != entry.id })
    }

    fun deleteSaved(entry: VoiceItem) {
        updateItems(items.filter { it.id != entry.id })
        scope.launch {
            runCatching { Api.delete("/api/registrations/${entry.id}") }
            NativeHooks.onRegistrationChanged()
        }
    }

    fun favorite(productId: String) {
        scope.launch { runCatching { Api.post("/api/favorites", mapOf("productId" to productId)) } }
    }

    fun changeLanguage(code: String) {
        if (code == lang.language) return
        lang.set(code)
        if (session != null) restartListening()
    }

    val isListening = phase == VoicePhase.Listening
    val isProcessing = phase == VoicePhase.Processing
    val hasAdded = phase == VoicePhase.Added
    val suggested = items.filter { !it.saved }
    val saved = items.filter { it.saved }

    Column(Modifier.fillMaxSize()) {
        HcAppBar(
            title = if (isListening) t.t("voice.listeningTitle") else "",
            leading = { MealLanguagePicker(lang.language, lang.region, ::changeLanguage) },
        )
        Box(Modifier.weight(1f)) {
            HcScreen(title = null) {
                // Mic button + status.
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.size(96.dp).clickable(enabled = !isProcessing && phase != VoicePhase.Unsupported) {
                            if (isListening) stopListening() else startListening()
                        },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (isListening || isProcessing) PingRing()
                        Box(
                            Modifier.size(80.dp).clip(CircleShape).background(if (phase == VoicePhase.Unsupported) HcColors.Gray else HcColors.Green),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (hasAdded) HcIcon("Check", size = 44.dp, stroke = 2.5f, color = HcColors.White)
                            else Image(standMicrophone, null, Modifier.size(56.dp), colorFilter = ColorFilter.tint(HcColors.White))
                        }
                    }
                    HcText(
                        when {
                            isListening -> t.t("voice.listeningStatus")
                            isProcessing -> t.t("voice.adding")
                            hasAdded -> t.t("voice.added")
                            phase == VoicePhase.Unsupported -> t.t("voice.unsupported")
                            else -> t.t("voice.tapToTalk")
                        },
                        HcTypeRoles.Small,
                        Modifier.padding(top = 8.dp),
                        bold = true,
                        color = HcColors.Green,
                    )
                    if (isListening) Waveform()
                    errorMessage?.let {
                        HcText(it, HcTypeRoles.Small, Modifier.padding(top = 8.dp).widthIn(max = 310.dp), color = HcColors.RedDark, align = TextAlign.Center)
                    }
                }

                // Transcript (editable when not listening) with the "start over" button.
                Box(Modifier.fillMaxWidth().padding(top = 16.dp)) {
                    val shape = RoundedCornerShape(16.dp)
                    if (isListening) {
                        Box(
                            Modifier.fillMaxWidth().padding(top = 8.dp).heightIn(min = 72.dp).clip(shape).background(HcColors.White, shape)
                                .border(1.dp, HcColors.TanDark, shape).padding(horizontal = 16.dp, vertical = 12.dp),
                        ) {
                            HcText((transcript.ifEmpty { t.t("voice.sayNothingYet") }) + " …", HcTypeRoles.Body, color = HcColors.Black)
                        }
                    } else {
                        Box(Modifier.padding(top = 8.dp).border(1.dp, HcColors.TanDark, shape).clip(shape)) {
                            CaptureFilledField(
                                transcript,
                                { transcript = it },
                                placeholder = t.t("voice.speechPlaceholder"),
                                background = HcColors.White,
                                singleLine = false,
                                minHeight = 96.dp,
                            )
                        }
                    }
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(top = 16.dp, end = 8.dp).size(32.dp).clip(CircleShape).background(HcColors.Black)
                            .clickable { restartListening() },
                        contentAlignment = Alignment.Center,
                    ) {
                        HcIcon("Refresh", size = 16.dp, color = HcColors.White)
                    }
                }

                if (suggested.isNotEmpty()) {
                    Column(Modifier.padding(top = 16.dp)) {
                        HcText(t.t("voice.suggested"), HcTypeRoles.Body, Modifier.padding(bottom = 4.dp), bold = true, color = HcColors.Black)
                        suggested.forEachIndexed { index, entry ->
                            VoiceItemRow(
                                entry,
                                onFavorite = entry.item.productId?.let { id -> { favorite(id) } },
                                onReportError = null,
                                onDelete = { deleteItem(entry) },
                                onAdd = { addItems(listOf(entry)) },
                                adding = isAdding,
                            )
                            if (index < suggested.lastIndex) HcLine()
                        }
                        if (suggested.size > 1) {
                            HcButton(
                                if (isAdding) t.t("voice.adding") else t.t("voice.addShownItems"),
                                onClick = { addItems(items.filter { !it.saved }) },
                                modifier = Modifier.padding(top = 16.dp),
                                enabled = !isAdding,
                            )
                        }
                    }
                }

                if (saved.isNotEmpty()) {
                    Column(Modifier.padding(top = 16.dp)) {
                        HcText(t.t("voice.added"), HcTypeRoles.Body, Modifier.padding(bottom = 4.dp), bold = true, color = HcColors.Black)
                        saved.forEachIndexed { index, entry ->
                            VoiceItemRow(
                                entry,
                                onFavorite = entry.item.productId?.let { id -> { favorite(id) } },
                                onReportError = { nav.push("/registration/${entry.id}/report-error") },
                                onDelete = { deleteItem(entry) },
                                onOpen = { nav.push("/registration/${entry.id}") },
                            )
                            if (index < saved.lastIndex) HcLine()
                        }
                    }
                }
            }
        }
    }

    confirmDelete?.let { entry ->
        CaptureEntryDetailsSheet(
            title = entry.item.title,
            rows = listOf(
                CaptureDetailRow(t.t("entrySheet.amount"), entry.item.amountLabel.ifEmpty { "${entry.item.amountGrams.roundToInt()} g" }),
                CaptureDetailRow(t.t("entrySheet.energy"), "${entry.item.kcal.roundToInt()} kcal"),
            ),
            onDelete = { deleteSaved(entry) },
            onClose = { confirmDelete = null },
        )
    }
}

/** VoiceItemRow (voice page) — also used by the chat page. */
@Composable
internal fun VoiceItemRow(
    entry: VoiceItem,
    onFavorite: (() -> Unit)?,
    onReportError: (() -> Unit)?,
    onDelete: () -> Unit,
    onAdd: (() -> Unit)? = null,
    adding: Boolean = false,
    onOpen: (() -> Unit)? = null,
    addLabel: String? = null,
) {
    val t = LocalTranslator.current
    val item = entry.item
    CaptureSwipeableRow(onDelete = onDelete, onFavorite = onFavorite, onReportError = onReportError) {
        Row(
            Modifier.fillMaxWidth().let { if (entry.saved && onOpen != null) it.clickable(onClick = onOpen) else it }.padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(HcColors.Tan)) {
                if (item.image != null) HcRemoteImage(item.image, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
            }
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    HcText(item.title, HcTypeRoles.Body, Modifier.weight(1f, fill = false), bold = true, color = HcColors.Black, maxLines = 1)
                    if (item.estimated) {
                        Box(Modifier.clip(RoundedCornerShape(50)).background(HcColors.Tan).alpha(0.7f).padding(horizontal = 6.dp, vertical = 2.dp)) {
                            HcText(t.t("voice.aiEstimate").uppercase(), HcTypeRoles.Micro, bold = true, color = HcColors.Black)
                        }
                    }
                }
                HcText(item.amountLabel, HcTypeRoles.Small, Modifier.padding(top = 4.dp), color = HcColors.TextSecondary)
            }
            HcText("${jsNumber(item.kcal)} kcal", HcTypeRoles.Small, color = HcColors.TextSecondary)
            if (entry.saved) HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black.copy(alpha = 0.4f))
            if (!entry.saved && onAdd != null) {
                HcButton(
                    addLabel ?: t.t("voice.addOne"),
                    onClick = onAdd,
                    modifier = Modifier.widthIn(max = 120.dp).height(40.dp),
                    kind = HcButtonKind.Secondary,
                    enabled = !adding,
                )
            }
        }
    }
}

/** The pulsing ring behind the mic while listening (animate-ping). */
@Composable
private fun PingRing() {
    val transition = rememberInfiniteTransition()
    val progress by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Restart))
    Box(Modifier.size(96.dp).scale(0.8f + progress * 0.4f).alpha(0.2f * (1f - progress)).clip(CircleShape).background(HcColors.Green))
}

/** 28 green bars moving like the web's waveform (the web reads the mic level; natively an idle wave). */
@Composable
private fun Waveform() {
    val transition = rememberInfiniteTransition()
    val time by transition.animateFloat(0f, (2 * PI).toFloat(), infiniteRepeatable(tween(2100, easing = LinearEasing), RepeatMode.Restart))
    Row(Modifier.padding(top = 16.dp).widthIn(max = 280.dp).fillMaxWidth().height(32.dp), horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.Bottom) {
        repeat(28) { i ->
            val level = (0.25f + 0.2f * sin(time * 3 + i * 0.6f)).coerceIn(0.06f, 1f)
            Box(Modifier.weight(1f).fillMaxHeight(level).clip(RoundedCornerShape(50)).background(HcColors.Green))
        }
    }
}

/** StandMicrophone (voice page SVG, 64×64). */
private val standMicrophone: ImageVector by lazy {
    ImageVector.Builder(name = "StandMicrophone", defaultWidth = 56.dp, defaultHeight = 56.dp, viewportWidth = 64f, viewportHeight = 64f).apply {
        addPath(
            pathData = addPathNodes("M32 5a10 10 0 0 1 10 10v11a10 10 0 0 1 -20 0v-11a10 10 0 0 1 10 -10z"),
            stroke = SolidColor(HcColors.Black),
            strokeLineWidth = 4f,
        )
        addPath(
            pathData = addPathNodes("M15 27v2a17 17 0 0 0 34 0v-2M32 46v10M22 57h20"),
            stroke = SolidColor(HcColors.Black),
            strokeLineWidth = 4f,
            strokeLineCap = StrokeCap.Round,
        )
        addPath(
            pathData = addPathNodes("M27 14h10M27 21h10M27 28h10"),
            stroke = SolidColor(HcColors.Black),
            strokeLineWidth = 2.5f,
            strokeLineCap = StrokeCap.Round,
        )
    }.build()
}

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
import dk.packroff.hellocal.ui.FoodRow
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

private const val VOICE_ITEMS_STORAGE_KEY = "hf-voice-added-items"

private fun voiceTodayKey() = CaptureDates.isoDate(CaptureDates.today())

/** Items saved earlier today survive navigating away and back; older ones are dropped (Madvarer's microphone). */
internal fun loadPersistedVoiceItems(): List<VoiceItem> {
    val raw = NativeHooks.secureStorage.get(VOICE_ITEMS_STORAGE_KEY) ?: return emptyList()
    val parsed = runCatching { ApiJson.decodeFromString(PersistedVoiceItems.serializer(), raw) }.getOrNull() ?: return emptyList()
    if (parsed.date != voiceTodayKey()) {
        NativeHooks.secureStorage.set(VOICE_ITEMS_STORAGE_KEY, null)
        return emptyList()
    }
    return parsed.items
}

internal fun persistVoiceItems(items: List<VoiceItem>) {
    val saved = items.filter { it.saved }
    NativeHooks.secureStorage.set(
        VOICE_ITEMS_STORAGE_KEY,
        if (saved.isEmpty()) null else ApiJson.encodeToString(PersistedVoiceItems.serializer(), PersistedVoiceItems(voiceTodayKey(), saved)),
    )
}

/** Tale-siden er flettet ind i Madvarer (2026-10-16): /voice åbner Madvarer med mikrofonen i gang. */
@Composable
fun VoiceScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val nav = LocalNavigator.current
    LaunchedEffect(Unit) { nav.replace("/foods?mic=1") }
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
    // Same row as the shared list card (src/components/voice/VoiceMealSuggestions.tsx → FoodRow).
    CaptureSwipeableRow(onDelete = onDelete, onFavorite = onFavorite, onReportError = onReportError, surface = HcColors.Tan) {
        FoodRow(
            title = item.title,
            image = item.image,
            modifier = Modifier.let { if (entry.saved && onOpen != null) it.clickable(onClick = onOpen) else it }.padding(horizontal = 16.dp),
            subtitle = {
                Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (item.estimated) {
                        Box(Modifier.clip(RoundedCornerShape(50)).background(HcColors.TanDark).padding(horizontal = 6.dp, vertical = 2.dp)) {
                            HcText(t.t("voice.aiEstimate").uppercase(), HcTypeRoles.Micro, bold = true, color = HcColors.Black)
                        }
                    }
                    HcText(item.amountLabel, HcTypeRoles.Small, color = HcColors.TextSecondary, maxLines = 1)
                }
            },
            right = {
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
            },
        )
    }
}

/** The pulsing ring behind the mic while listening (animate-ping). */
@Composable
internal fun PingRing() {
    val transition = rememberInfiniteTransition()
    val progress by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Restart))
    Box(Modifier.size(96.dp).scale(0.8f + progress * 0.4f).alpha(0.2f * (1f - progress)).clip(CircleShape).background(HcColors.Green))
}

/** 28 green bars under the mic while listening (src/components/voice/LiveWaveform.tsx; the web reads the mic level, natively an idle wave). */
@Composable
internal fun LiveWaveform() {
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
internal val standMicrophone: ImageVector by lazy {
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

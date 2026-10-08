package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.platform.Device
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsSupportBytesImage
import dk.packroff.hellocal.ui.icons.HcIcon
import io.ktor.client.call.body
import io.ktor.http.HttpMethod
import io.ktor.http.isSuccess
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

// Shared pieces of the Support screens (src/app/settings/support/**):
// the screenshot picker (src/components/SupportScreenshotPicker.tsx), the
// textarea, protected attachment images and the case code / date formats.

/**
 * Phone features the Support screens need, forwarded to the shared device
 * layer (platform/Device.kt). Left null, the matching button is hidden.
 * - openHelpChat: opens the help chat (web: openHelpChat() in
 *   src/lib/help-chat-events.ts, HelpChat mounted in the layout). Natively it
 *   sets [helpChatOpen]; the Support page shows SettingsHelpChatSheet while it is true.
 * - pickScreenshots: opens the system photo picker (up to maxCount images),
 *   scales each to max 1600 px on the longest edge, re-encodes as JPEG 0.8
 *   (strips EXIF/GPS, docs/PRIVACY.md) and returns "data:image/jpeg;base64,…"
 *   strings; failed = true when one of the images could not be used.
 */
object SettingsSupportHooks {
    /** The native help chat sheet is open (web: HelpChat open state). Compose state. */
    var helpChatOpen by mutableStateOf(false)

    private val openHelpChatCall: () -> Unit = { helpChatOpen = true }
    private val pickScreenshotsCall: (Int, (List<String>, Boolean) -> Unit) -> Unit = { maxCount, onResult ->
        val platform = Device.platform
        if (platform == null) {
            onResult(emptyList(), true)
        } else {
            platform.pickPhotos(maxCount.coerceAtLeast(1), Device.PHOTO_MAX_EDGE, 0.8) { photos, error ->
                val failed = error != null
                onResult(photos.take(maxCount).map { Device.jpegDataUrl(it) }, failed)
            }
        }
    }

    val openHelpChat: (() -> Unit)?
        get() = openHelpChatCall
    val pickScreenshots: ((maxCount: Int, onResult: (images: List<String>, failed: Boolean) -> Unit) -> Unit)?
        get() = if (Device.available) pickScreenshotsCall else null
}

/** Last 8 characters of the request id, upper-cased (web: id.slice(-8).toUpperCase()). */
internal fun settingsSupportCaseCode(id: String): String = id.takeLast(8).uppercase()

/** new Date(iso).toLocaleString() in Danish: "8.10.2026, 04.05.03". */
internal fun settingsSupportFormatDateTime(iso: String): String {
    val dt = runCatching { Instant.parse(iso).toLocalDateTime(TimeZone.currentSystemDefault()) }.getOrNull() ?: return iso
    fun two(n: Int) = n.toString().padStart(2, '0')
    return "${dt.dayOfMonth}.${dt.monthNumber}.${dt.year}, ${two(dt.hour)}.${two(dt.minute)}.${two(dt.second)}"
}

private const val SETTINGS_SUPPORT_MAX_IMAGES = 3

@OptIn(ExperimentalEncodingApi::class)
private fun settingsSupportDataUrlBytes(dataUrl: String): ByteArray? =
    runCatching { Base64.Default.decode(dataUrl.substringAfter("base64,")) }.getOrNull()

private val settingsSupportAttachmentCache = mutableMapOf<String, ByteArray>()

/** GET /api/support/attachments/{id} with the session cookie. */
private suspend fun settingsSupportLoadAttachment(id: String): ByteArray? {
    settingsSupportAttachmentCache[id]?.let { return it }
    val bytes = runCatching {
        val response = Api.raw(HttpMethod.Get, "/api/support/attachments/$id")
        if (response.status.isSuccess()) response.body<ByteArray>() else null
    }.getOrNull() ?: return null
    settingsSupportAttachmentCache[id] = bytes
    return bytes
}

/** <img src="/api/support/attachments/{id}"> — loaded through Api so the login cookie is sent. */
@Composable
internal fun SettingsSupportAttachmentImage(id: String, modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Crop) {
    var bytes by remember(id) { mutableStateOf(settingsSupportAttachmentCache[id]) }
    LaunchedEffect(id) {
        if (bytes == null) bytes = settingsSupportLoadAttachment(id)
    }
    SettingsSupportBytesImage(bytes, modifier, contentScale)
}

/** <label><span class="hf-type-label"/><textarea rows maxLength class="hf-type-input … bg-hf-cream p-3"/></label> */
@Composable
internal fun SettingsSupportTextArea(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    minLines: Int,
    maxLength: Int,
) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HcText(label, HcTypeRoles.Label)
        BasicTextField(
            value = value,
            onValueChange = { onValueChange(it.take(maxLength)) },
            minLines = minLines,
            textStyle = HcTypeRoles.Input.style(),
            cursorBrush = SolidColor(HcColors.Action),
            modifier = Modifier
                .fillMaxWidth()
                .background(HcColors.Cream, shape)
                .border(1.dp, HcColors.FieldBorder, shape)
                .padding(12.dp),
        )
    }
}

/** src/components/SupportScreenshotPicker.tsx — up to 3 screenshots as data URLs. */
@Composable
internal fun SettingsSupportScreenshotPicker(images: List<String>, onChange: (List<String>) -> Unit, disabled: Boolean) {
    val t = LocalTranslator.current
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    var error by remember { mutableStateOf(false) }
    val currentImages by rememberUpdatedState(images)
    val currentOnChange by rememberUpdatedState(onChange)
    val pick = SettingsSupportHooks.pickScreenshots

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            images.forEachIndexed { index, src ->
                Box(Modifier.size(80.dp).clip(shape).background(HcColors.Tan)) {
                    val bytes = remember(src) { settingsSupportDataUrlBytes(src) }
                    SettingsSupportBytesImage(bytes, Modifier.fillMaxSize())
                    Box(
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(HcColors.Black)
                            .clickable { currentOnChange(currentImages.filterIndexed { i, _ -> i != index }) },
                        contentAlignment = Alignment.Center,
                    ) {
                        HcIcon("X", size = 14.dp, stroke = 2.5f, color = HcColors.White, contentDescription = t.t("settings.support.removeAttachment"))
                    }
                }
            }
            // The system photo picker (Device.pickPhotos); only missing without a platform (previews).
            if (images.size < SETTINGS_SUPPORT_MAX_IMAGES && pick != null) {
                Box(
                    Modifier
                        .size(80.dp)
                        .alpha(if (disabled) 0.5f else 1f)
                        .clip(shape)
                        .drawBehind {
                            val strokeWidth = 1.dp.toPx()
                            drawRoundRect(
                                color = HcColors.Black,
                                cornerRadius = CornerRadius(HcDimens.RadiusCard.toPx(), HcDimens.RadiusCard.toPx()),
                                style = Stroke(width = strokeWidth, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
                            )
                        }
                        .clickable(enabled = !disabled) {
                            error = false
                            pick(SETTINGS_SUPPORT_MAX_IMAGES - currentImages.size) { picked, failed ->
                                if (failed) error = true
                                currentOnChange((currentImages + picked).take(SETTINGS_SUPPORT_MAX_IMAGES))
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    HcIcon("PhotoPlus", size = 24.dp, stroke = 1.75f, contentDescription = t.t("settings.support.attachScreenshots"))
                }
            }
        }
        HcText(t.t("settings.support.attachHint"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
        if (error) HcError(t.t("settings.support.attachmentError"))
    }
}

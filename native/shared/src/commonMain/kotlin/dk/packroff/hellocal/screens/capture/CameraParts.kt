package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon

/** Camera status texts (cameraMessage() on the web). */
internal enum class CameraStatus { Active, Denied, Unavailable, Error }

internal fun cameraMessage(status: CameraStatus, t: Translator): String? = when (status) {
    CameraStatus.Active -> null
    CameraStatus.Denied -> t.t("camera.deniedAccess")
    CameraStatus.Unavailable -> t.t("camera.unavailable")
    CameraStatus.Error -> t.t("camera.error")
}

/** The black square camera area (relative aspect-square bg-hf-black rounded-card). */
@Composable
internal fun CameraViewport(onClick: (() -> Unit)? = null, content: @Composable BoxScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(
        Modifier.fillMaxWidth().aspectRatio(1f).clip(shape).background(HcColors.Black, shape)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it },
        content = content,
    )
}

/** A captured photo filling the viewport (object-cover). */
@Composable
internal fun BoxScope.CapturedPhoto(bytes: ByteArray?, contentDescription: String?) {
    if (bytes != null) AsyncImage(model = bytes, contentDescription = contentDescription, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
}

/** Full overlay with a centred white message (bg-hf-black/75). */
@Composable
internal fun BoxScope.CameraMessageOverlay(message: String, onClick: (() -> Unit)? = null) {
    Box(
        Modifier.matchParentSize().background(HcColors.Black.copy(alpha = 0.75f))
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        HcText(message, HcTypeRoles.Body, bold = true, color = HcColors.White, align = TextAlign.Center)
    }
}

/** Round guide (68 % circle) shown before a meal/product photo. */
@Composable
internal fun BoxScope.CircleGuide() {
    Box(Modifier.matchParentSize().background(HcColors.Black.copy(alpha = 0.2f)))
    Box(Modifier.align(Alignment.Center).fillMaxWidth(0.68f).aspectRatio(1f).border(2.dp, HcColors.White.copy(alpha = 0.8f), CircleShape))
}

/** Square guide frame (inset 4 %/12 %) for the product photo steps. */
@Composable
internal fun BoxScope.SquareGuide(inset: Float) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(Modifier.matchParentSize().background(HcColors.Black.copy(alpha = 0.2f)))
    Box(Modifier.align(Alignment.Center).fillMaxWidth(1f - 2 * inset).aspectRatio(1f).border(2.dp, HcColors.White.copy(alpha = 0.8f), shape))
}

/** Pill hint at the top of the viewport (rounded-full bg-hf-black/60). */
@Composable
internal fun BoxScope.CameraTopHint(text: String) {
    Box(
        Modifier.align(Alignment.TopCenter).padding(16.dp).fillMaxWidth().clip(RoundedCornerShape(50))
            .background(HcColors.Black.copy(alpha = 0.6f)).padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        HcText(text, HcTypeRoles.Small, bold = true, color = HcColors.White, align = TextAlign.Center)
    }
}

/** PhotoWorkingOverlay (src/components/hf/HfLoader.tsx): dim + spinner + label. */
@Composable
internal fun BoxScope.PhotoWorkingOverlay(label: String) {
    Box(Modifier.matchParentSize().background(HcColors.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
        androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
            HcLoader(Modifier.padding(8.dp))
            HcText(label, HcTypeRoles.Small, bold = true, color = HcColors.White, align = TextAlign.Center)
        }
    }
}

/** CaptureCheckOverlay: a green round check mark in the corner of a step button. */
@Composable
internal fun BoxScope.CheckBadge(size: Dp = 24.dp) {
    Box(
        Modifier.align(Alignment.TopEnd).padding(4.dp).size(size).clip(CircleShape).background(HcColors.Brand),
        contentAlignment = Alignment.Center,
    ) {
        HcIcon("Check", size = size * 0.7f, color = HcColors.White, stroke = 2.5f)
    }
}

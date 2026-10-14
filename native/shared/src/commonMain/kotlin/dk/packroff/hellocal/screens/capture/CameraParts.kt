package dk.packroff.hellocal.screens.capture

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay

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

/**
 * Square guide frame for the product photo steps (inset 4 %/12 %/16 %). `dim`
 * is how dark the rest of the picture is: the front keeps the light 0.2, the
 * energy/contents fields use 0.55 so only the field is seen (user 2026-10-14).
 */
@Composable
internal fun BoxScope.SquareGuide(inset: Float, dim: Float = 0.2f, topInset: Float = inset) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(Modifier.matchParentSize().background(HcColors.Black.copy(alpha = dim)))
    BoxWithConstraints(Modifier.matchParentSize()) {
        Box(
            Modifier.align(Alignment.TopCenter).padding(top = maxHeight * topInset).fillMaxWidth(1f - 2 * inset).aspectRatio(1f)
                .border(2.dp, HcColors.White.copy(alpha = 0.8f), shape),
        )
    }
}

/**
 * Barcode-sized field (56 % wide, 2.2:1 like BarcodeScanOverlay on the web)
 * with the rest of the picture dark (user 2026-10-14) and the barcode icon inside.
 */
@Composable
internal fun BoxScope.BarcodeGuide() {
    Box(Modifier.matchParentSize().background(HcColors.Black.copy(alpha = 0.55f)))
    Box(
        Modifier.align(Alignment.Center).fillMaxWidth(0.56f).aspectRatio(2.2f).border(1.dp, HcColors.White.copy(alpha = 0.8f), RoundedCornerShape(6.dp)),
        contentAlignment = Alignment.Center,
    ) {
        HcIcon("Barcode", size = 64.dp, color = HcColors.White.copy(alpha = 0.85f), stroke = 1.2f)
    }
}

/** .hf-scan-heading__title (24/30 bold) and the small struck-through done line (13/18). */
private val ScanTitleRole = HcTypeRole(24f, FontWeight(700), 30f, true, HcColors.White)
private val ScanDoneRole = HcTypeRole(13f, FontWeight(700), 18f, false, HcColors.White)
private val StepDoneTitleRole = HcTypeRole(28f, FontWeight(700), 34f, true, HcColors.White)

/**
 * ScanHeading (src/components/camera/ScanHeading.tsx): the numbered step
 * heading at the top of the viewport in the dark gradient, with the most
 * recently completed step small and struck through with a check above it.
 */
@Composable
internal fun BoxScope.ScanHeading(title: String, done: String?) {
    Column(
        Modifier.align(Alignment.TopCenter).fillMaxWidth()
            .background(Brush.verticalGradient(listOf(HcColors.Black.copy(alpha = 0.6f), HcColors.Black.copy(alpha = 0f))))
            .padding(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (done != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.alpha(0.9f)) {
                Text(done, style = ScanDoneRole.style(HcColors.White).copy(textDecoration = TextDecoration.LineThrough))
                Box(Modifier.size(18.dp).clip(CircleShape).background(HcColors.Positive), contentAlignment = Alignment.Center) {
                    HcIcon("Check", size = 12.dp, color = HcColors.White, stroke = 3.5f)
                }
            }
        }
        HcText(title, ScanTitleRole, color = HcColors.White, align = TextAlign.Center)
    }
}

internal const val STEP_DONE_MS = 1600L

/**
 * StepDoneOverlay (src/components/camera/StepDoneOverlay.tsx, user 2026-10-14):
 * the whole picture flashes white, the completed step(s) stand large in the
 * middle, get struck through with a big check, and the line flies up and
 * shrinks before the next step's heading takes over. Lasts STEP_DONE_MS.
 */
@Composable
internal fun BoxScope.StepDoneOverlay(titles: List<String>) {
    // 0 = flash, 1 = strike, 2 = check, 3 = fly up.
    var phase by remember(titles) { mutableIntStateOf(0) }
    LaunchedEffect(titles) {
        delay(220)
        phase = 1
        delay(240)
        phase = 2
        delay(690)
        phase = 3
    }
    val flash by animateFloatAsState(if (phase == 0) 1f else 0f, tween(380), label = "flash")
    val strike by animateFloatAsState(if (phase >= 1) 1f else 0f, tween(300), label = "strike")
    val check by animateFloatAsState(if (phase >= 2) 1f else 0f, tween(260), label = "check")
    val fly by animateFloatAsState(if (phase >= 3) 1f else 0f, tween(400), label = "fly")

    Box(Modifier.matchParentSize().alpha(flash).background(HcColors.White))
    Column(
        Modifier.align(if (fly >= 1f) Alignment.TopCenter else Alignment.Center)
            .padding(horizontal = 12.dp, vertical = 14.dp)
            .scale(1f - 0.5f * fly)
            .alpha(1f - fly),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        titles.forEach { title ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(contentAlignment = Alignment.CenterStart) {
                    HcText(title, StepDoneTitleRole, color = HcColors.White, align = TextAlign.Center)
                    Box(Modifier.fillMaxWidth(strike).height(3.dp).clip(RoundedCornerShape(2.dp)).background(HcColors.White))
                }
                Box(Modifier.size(56.dp).scale(check).clip(CircleShape).background(HcColors.Positive), contentAlignment = Alignment.Center) {
                    HcIcon("Check", size = 34.dp, color = HcColors.White, stroke = 3f)
                }
            }
        }
    }
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

/** CaptureCheckOverlay: a big check mark in the light signature green, no background (user 2026-10-14). */
@Composable
internal fun BoxScope.CheckBadge(size: Dp = 48.dp) {
    Box(Modifier.matchParentSize(), contentAlignment = Alignment.Center) {
        HcIcon("Check", size = size, color = HcColors.Positive, stroke = 3.5f)
    }
}

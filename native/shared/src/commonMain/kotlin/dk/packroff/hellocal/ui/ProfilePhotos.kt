package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import dk.packroff.hellocal.theme.HcColors

/**
 * A photo kept only on the device (the photo diary's images, the web's
 * object URLs for IndexedDB blobs). [onRatio] reports width/height once loaded.
 */
@Composable
fun ProfileBytesImage(
    bytes: ByteArray,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    contentDescription: String? = null,
    onRatio: ((Float) -> Unit)? = null,
) {
    AsyncImage(
        model = bytes,
        contentDescription = contentDescription,
        modifier = modifier,
        contentScale = contentScale,
        onSuccess = { state ->
            val size = state.painter.intrinsicSize
            if (onRatio != null && size.width > 0f && size.height > 0f) onRatio(size.width / size.height)
        },
    )
}

/** A dark full-screen layer above everything (fixed inset-0 bg-hf-black on the web). */
@Composable
fun ProfileFullScreenLayer(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(HcColors.Black)) { content() }
    }
}

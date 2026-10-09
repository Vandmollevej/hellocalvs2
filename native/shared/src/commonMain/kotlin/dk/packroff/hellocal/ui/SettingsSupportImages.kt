package dk.packroff.hellocal.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage

/**
 * An image from raw bytes (a support screenshot data URL picked on the phone,
 * or a protected /api/support/attachments/{id} image fetched with the session
 * cookie through Api). Plain HcRemoteImage cannot be used for the latter: the
 * image loader's own HTTP client does not send the login cookie.
 */
@Composable
fun SettingsSupportBytesImage(
    bytes: ByteArray?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
) {
    if (bytes == null) {
        Box(modifier)
        return
    }
    AsyncImage(model = bytes, contentDescription = null, modifier = modifier, contentScale = contentScale)
}

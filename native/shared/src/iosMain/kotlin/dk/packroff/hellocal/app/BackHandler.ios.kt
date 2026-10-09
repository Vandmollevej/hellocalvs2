package dk.packroff.hellocal.app

import androidx.compose.runtime.Composable

@Composable
actual fun BackHandler(enabled: Boolean, onBack: () -> Unit) {
    // iPhone has no system back button; screens show a back arrow in HcAppBar.
}

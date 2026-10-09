package dk.packroff.hellocal.app

import androidx.compose.runtime.Composable

/** System back (Android back button/gesture). iPhone uses the app bar's back arrow. */
@Composable
expect fun BackHandler(enabled: Boolean, onBack: () -> Unit)

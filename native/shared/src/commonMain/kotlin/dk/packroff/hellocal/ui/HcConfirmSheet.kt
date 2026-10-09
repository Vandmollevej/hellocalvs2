package dk.packroff.hellocal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcTypeRoles

/**
 * src/lib/use-confirm-sheet.tsx useConfirmSheet — a confirmation as a bottom
 * sheet instead of window.confirm (owner's rule 2026-10-07): the message and
 * "Fortsæt" (BottomSheetCloseButton: [onConfirm] runs, then the sheet slides
 * out and [onDismiss] is called). Swipe down or the scrim closes without it.
 */
@Composable
fun HcConfirmSheet(message: String, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    val t = LocalTranslator.current
    HcBottomSheet(onDismiss = onDismiss, title = message) {
        val closeSheet = LocalHcSheetClose.current
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HcText(message, HcTypeRoles.Body)
            HcButton(t.t("common.continue"), onClick = {
                onConfirm()
                closeSheet()
            })
        }
    }
}

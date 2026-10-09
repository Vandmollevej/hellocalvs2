package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.screens.food.FoodPlatform
import dk.packroff.hellocal.screens.food.obj
import dk.packroff.hellocal.screens.food.str
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodPillField
import dk.packroff.hellocal.ui.FoodTextArea
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.launch

private val FORWARD_DAYS = listOf(1, 7, 30, 90)
private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

/**
 * src/components/recipes/ForwardRecipeSheet.tsx — send a dish to a friend: full-page
 * popup with link lifetime, the friend's name + email, "From" and an optional note.
 * "Share" creates the encrypted link (POST /api/forwards) and opens the share sheet.
 */
@Composable
fun ForwardRecipeSheet(dishId: String, name: String, onClose: () -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var days by remember { mutableStateOf(7) }
    var toName by remember { mutableStateOf("") }
    var toEmail by remember { mutableStateOf("") }
    var fromName by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var copied by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val own = Api.get("/api/profile").obj("user").str("displayName")
            if (own != null && fromName.isEmpty()) fromName = own
        } catch (_: Exception) {
        }
    }

    fun share() {
        if (toName.isBlank() || !EMAIL.matches(toEmail.trim()) || fromName.isBlank()) {
            error = t.t("forwardRecipe.missing")
            return
        }
        busy = true
        error = null
        scope.launch {
            try {
                val body = mapOf(
                    "kind" to "DISH",
                    "dishId" to dishId,
                    "expiresInHours" to days * 24,
                    "recipientName" to toName,
                    "recipientEmail" to toEmail,
                    "fromName" to fromName,
                    "message" to message,
                )
                val link = Api.post("/api/forwards", body).str("link")
                if (link == null) {
                    error = t.t("forwardRecipe.error")
                } else {
                    val text = message.trim().ifEmpty { t.t("forwardRecipe.shareText", "name" to name) }
                    val shared = FoodPlatform.share?.invoke(name, text, link) == true
                    if (shared) {
                        onClose()
                    } else {
                        clipboard.setText(AnnotatedString(link))
                        copied = true
                    }
                }
            } catch (e: ApiException) {
                error = e.body.str("message") ?: t.t("forwardRecipe.error")
            } catch (_: Exception) {
                error = t.t("forwardRecipe.error")
            }
            busy = false
        }
    }

    HcBottomSheet(
        onDismiss = onClose,
        title = t.t("forwardRecipe.title"),
        size = HcSheetSize.Full,
        scrollable = true,
        footer = {
            error?.let { HcText(it, HcTypeRoles.Body, Modifier.fillMaxWidth().padding(bottom = 8.dp), color = HcColors.TextSecondary, align = TextAlign.Center) }
            if (copied) HcText(t.t("forwardRecipe.copied"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(bottom = 8.dp), color = HcColors.Black, align = TextAlign.Center)
            HcButton(if (busy) t.t("forwardRecipe.sending") else t.t("forwardRecipe.share"), onClick = ::share, enabled = !busy)
        },
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcText(t.t("forwardRecipe.title"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
            HcText(t.t("forwardRecipe.hint", "name" to name), HcTypeRoles.Body, color = HcColors.TextSecondary)
            HcText(t.t("forwardRecipe.duration"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
            FORWARD_DAYS.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { value ->
                        val selected = days == value
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(50)).background(if (selected) HcColors.Black else HcColors.White)
                                .border(1.dp, HcColors.Black, RoundedCornerShape(50)).clickable { days = value }.padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) { HcText(t.t("forwardRecipe.days.$value"), HcTypeRoles.Small, color = if (selected) HcColors.White else HcColors.Black, bold = true) }
                    }
                }
            }
            FoodPillField(toName, { toName = it }, t.t("forwardRecipe.toName"), Modifier.fillMaxWidth())
            FoodPillField(toEmail, { toEmail = it }, t.t("forwardRecipe.toEmail"), Modifier.fillMaxWidth(), keyboardType = KeyboardType.Email)
            FoodPillField(fromName, { fromName = it }, t.t("forwardRecipe.fromName"), Modifier.fillMaxWidth())
            FoodTextArea(message, { message = it }, placeholder = t.t("forwardRecipe.message"), minLines = 4, background = HcColors.Tan, border = false)
            HcText(t.t("forwardRecipe.encrypted"), HcTypeRoles.Small, color = HcColors.TextSecondary)
        }
    }
}

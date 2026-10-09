package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileLine
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/** src/lib/points-constants.ts */
const val FREE_MONTH_COST = 300

// The web page hard-codes these Danish labels (Record<PointsReason, string>).
private val REASON_LABELS = mapOf(
    "PRODUCT_APPROVED" to "Vare godkendt",
    "PRODUCT_INGREDIENTS_BONUS" to "Varedeklaration tilføjet",
    "PRODUCT_PHOTOS_BONUS" to "Billeder fra flere vinkler",
    "BUG_REPORT_APPROVED" to "Fejlrapport godkendt",
    "FRIEND_FORWARD_FULFILLED" to "Videresendelse brugt af en ven",
    "FRIEND_REFERRAL" to "Invitér en ven",
    "FREE_MONTH_REDEEMED" to "Indløst til gratis måned",
    "PRODUCT_UPDATED" to "Vare opdateret",
    "QUALITY_CONTROL_PHOTO" to "Nyt billede godkendt",
    "PRODUCT_RESCAN" to "Vare scannet igen",
    "SIGNUP_BONUS" to "Startbonus",
    "INTEGRATION_TESTER" to "Testperson af integration",
    "ADMIN_GRANT" to "Tildelt af HELLO CAL",
)

@Serializable
private data class PointsTransaction(val id: String, val reason: String, val amount: Int, val createdAt: String)

/** Native port of src/app/profile/points/page.tsx. */
@Composable
fun PointsScreen(args: RouteArgs) {
    val scope = rememberCoroutineScope()
    var balance by remember { mutableStateOf<Int?>(null) }
    var transactions by remember { mutableStateOf<List<PointsTransaction>>(emptyList()) }
    var redeeming by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        val data = runCatching { Api.get("/api/points") as JsonObject }.getOrNull() ?: return
        balance = data["balance"]?.jsonPrimitive?.intOrNull
        transactions = data["transactions"]?.let {
            runCatching { ApiJson.decodeFromJsonElement(ListSerializer(PointsTransaction.serializer()), it) }.getOrNull()
        } ?: emptyList()
    }

    LaunchedEffect(Unit) { load() }

    fun redeem() {
        redeeming = true
        message = null
        scope.launch {
            try {
                Api.post("/api/points/redeem")
                message = "1 gratis måned er tilføjet dit abonnement!"
                load()
            } catch (e: ApiException) {
                message = e.message.ifBlank { "Kunne ikke indløse points" }
            } catch (e: Exception) {
                message = "Kunne ikke indløse points"
            } finally {
                redeeming = false
            }
        }
    }

    HcScreen(title = "Points", contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp)) {
        val shape = RoundedCornerShape(8.dp)
        Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Brand, shape).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            HcText("Din saldo", HcTypeRoles.Caption, color = HcColors.White)
            HcText(balance?.toString() ?: "…", HcTypeRoles.Hero, color = HcColors.White)
            HcText("points", HcTypeRoles.Caption, color = HcColors.White)
        }

        Column(Modifier.fillMaxWidth().padding(top = 16.dp).border(1.dp, HcColors.Line, shape).padding(16.dp)) {
            HcText(
                "$FREE_MONTH_COST points kan indløses til 1 gratis måned med Seriøs — ingen betalingskort nødvendigt. Abonnementet falder tilbage til Gratis igen bagefter.",
                HcTypeRoles.Body,
            )
            HcButton(
                if (redeeming) "Indløser…" else "Indløs $FREE_MONTH_COST points til 1 gratis måned",
                onClick = ::redeem,
                enabled = !redeeming && (balance ?: 0) >= FREE_MONTH_COST,
                modifier = Modifier.padding(top = 16.dp),
            )
            message?.let { HcText(it, HcTypeRoles.Caption, Modifier.padding(top = 8.dp)) }
        }

        HcSectionTitle("Historik", Modifier.padding(top = 16.dp))
        if (transactions.isEmpty()) {
            HcText("Ingen points optjent endnu.", HcTypeRoles.Body, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
        } else {
            Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                transactions.forEach { tx ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            HcText(REASON_LABELS[tx.reason] ?: tx.reason, HcTypeRoles.Body)
                            HcText(ProfileDates.shortDate(tx.createdAt), HcTypeRoles.Caption, color = HcColors.TextSecondary)
                        }
                        HcText(
                            if (tx.amount > 0) "+${tx.amount}" else tx.amount.toString(),
                            HcTypeRoles.Body,
                            color = if (tx.amount < 0) HcColors.Inactive else null,
                            align = TextAlign.End,
                        )
                    }
                    ProfileLine()
                }
            }
        }
    }
}

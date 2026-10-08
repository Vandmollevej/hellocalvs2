package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.food.MealShare
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** GET /api/forwards/[token] (src/lib/forward-view.ts loadForwardView). */
@Serializable
internal data class ForwardItem(val id: String = "", val name: String = "")

@Serializable
internal data class ForwardInfo(
    val kind: String = "PRODUCT",
    val item: ForwardItem = ForwardItem(),
    val senderDisplayName: String? = null,
    val senderName: String = "En ven",
    val amountGrams: Double = 100.0,
)

@Serializable
private data class ForwardResponse(val forward: ForwardInfo)

/** A message the web page shows instead of the item; `danger` = text-hf-red-dark. */
private data class ForwardMessage(val text: String, val danger: Boolean)

/**
 * Native port of src/app/forward/[token]/page.tsx ("Videresend ret/produkt til en ven", recipient side)
 * and src/components/AddForwardedItemButton.tsx.
 *
 * Requires login like the web page. Logged in, GET /api/forwards/[token] claims the
 * forward for this user (recipientId + OPENED, cross-send check) exactly like the page.
 * Points for the sender are only given when the item is actually added
 * (POST /api/registrations → fulfillMatchingForward).
 */
@Composable
fun ForwardScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val token = args["token"]
    val loggedIn = Session.state == Session.State.LoggedIn
    var forward by remember(token) { mutableStateOf<ForwardInfo?>(null) }
    var message by remember(token) { mutableStateOf<ForwardMessage?>(null) }
    var saving by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token, loggedIn) {
        if (!loggedIn) return@LaunchedEffect
        try {
            forward = ApiJson.decodeFromJsonElement(ForwardResponse.serializer(), Api.get("/api/forwards/" + Location.encode(token))).forward
        } catch (e: CancellationException) {
            throw e
        } catch (e: ApiException) {
            // 404 "Linket er ikke gyldigt." / "Varen findes ikke længere." are plain text;
            // 403 (cross-send block) and 500 are red on the web.
            val code = ((e.body as? JsonObject)?.get("code") as? JsonPrimitive)?.contentOrNull
            message = ForwardMessage(e.serverMessage() ?: "Kunne ikke åbne linket.", danger = code == "abuse" || code == "failed" || e.status >= 500)
        } catch (_: Exception) {
            message = ForwardMessage("Kunne ikke åbne linket.", danger = true)
        }
    }

    fun add(info: ForwardInfo) {
        saving = true
        error = null
        scope.launch {
            try {
                val body = buildMap<String, Any> {
                    put(if (info.kind == "PRODUCT") "productId" else "dishId", info.item.id)
                    put("amountGrams", info.amountGrams)
                    putAll(MealShare.body())
                }
                Api.post("/api/registrations", body)
                NativeHooks.onRegistrationChanged()
                saving = false
                done = true
                delay(1200)
                nav.push("/calendar")
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                saving = false
                error = e.serverMessage() ?: "Kunne ikke tilføje"
            } catch (_: Exception) {
                saving = false
                error = "Kunne ikke tilføje"
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(HcColors.Page).statusBarsPadding().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 384.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            val info = forward
            val shown = message
            when {
                !loggedIn -> {
                    HcText("Log ind for at se hvad din ven har sendt dig.", HcTypeRoles.Body, Modifier.fillMaxWidth(), align = TextAlign.Center)
                    HcButton("Log ind", onClick = { nav.push("/login?next=/forward/$token") }, modifier = Modifier.padding(top = 16.dp))
                }
                shown != null -> HcText(
                    shown.text,
                    HcTypeRoles.Body,
                    Modifier.fillMaxWidth(),
                    color = if (shown.danger) HcColors.RedDark else null,
                    align = TextAlign.Center,
                )
                info == null -> HcLoader()
                else -> {
                    HcText("${info.senderName} har sendt dig", HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                    HcText(info.item.name, HcTypeRoles.PageTitle, Modifier.fillMaxWidth().padding(top = 4.dp), align = TextAlign.Center)
                    Column(Modifier.fillMaxWidth().padding(top = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (done) {
                            HcText("Tilføjet til i dag!", HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.GreenDark, align = TextAlign.Center)
                        } else {
                            HcButton(
                                if (saving) "Tilføjer…" else "Tilføj ${info.item.name} til i dag",
                                onClick = { add(info) },
                                enabled = !saving,
                            )
                            error?.let { HcText(it, HcTypeRoles.Caption, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center) }
                        }
                    }
                }
            }
        }
    }
}

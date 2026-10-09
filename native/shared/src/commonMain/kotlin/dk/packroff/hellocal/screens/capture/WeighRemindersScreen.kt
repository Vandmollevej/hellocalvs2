package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

/** src/lib/weigh-reminder-hours.ts */
private val REMINDER_HOURS = listOf(6, 8, 10, 12, 14, 16, 18, 20, 22)

/**
 * Native port of src/app/weigh-reminders/page.tsx (docs/DECISIONS.md 2026-10-07):
 * the day as a timeline with one switch per 2 hours; a push 5 minutes before.
 * The web page hard-codes its Danish texts, so they are hard-coded here too.
 */
@Composable
fun WeighRemindersScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val scope = rememberCoroutineScope()
    var enabled by remember { mutableStateOf(false) }
    var hours by remember { mutableStateOf(REMINDER_HOURS) }
    var loaded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching { Api.get("/api/weigh-reminders") as? JsonObject }.getOrNull()?.let { data ->
            enabled = data["enabled"]?.jsonPrimitive?.booleanOrNull ?: false
            val list = runCatching { data["hours"]?.jsonArray?.mapNotNull { it.jsonPrimitive.intOrNull } }.getOrNull().orEmpty()
            if (list.isNotEmpty()) hours = list
        }
        loaded = true
    }

    fun save(nextEnabled: Boolean, nextHours: List<Int>) {
        enabled = nextEnabled
        hours = nextHours
        scope.launch { runCatching { Api.put("/api/weigh-reminders", mapOf("enabled" to nextEnabled, "hours" to nextHours)) } }
    }

    HcScreen(title = "Vejepåmindelser") {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcText(
                "Vej dig på samme tidspunkt og under samme forhold. Vælg de tidspunkter, hvor du vil have en påmindelse 5 minutter før.",
                HcTypeRoles.Body,
                color = HcColors.TextSecondary,
            )
            HcToggle(
                checked = enabled,
                onChange = { save(it, hours) },
                label = "Påmind mig om at veje mig",
                description = "Kræver, at notifikationer er slået til på din enhed.",
                enabled = loaded,
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                REMINDER_HOURS.forEach { hour ->
                    val on = hour in hours
                    val shape = RoundedCornerShape(HcDimens.RadiusCard)
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.Surface, shape)
                            .padding(start = 16.dp, end = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        HcText("${hour.toString().padStart(2, '0')}:00", HcTypeRoles.Body, color = HcColors.Black)
                        HcText(
                            "påmindelse ${(hour - 1).toString().padStart(2, '0')}:55",
                            HcTypeRoles.Small,
                            Modifier.padding(start = 8.dp).weight(1f),
                            color = HcColors.TextSecondary,
                        )
                        HcToggle(
                            checked = on,
                            onChange = { value -> save(enabled, if (value) (hours + hour).sorted() else hours.filter { it != hour }) },
                            enabled = enabled,
                        )
                    }
                }
            }
        }
    }
}

package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureLine
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

/** src/lib/meal-input-language.ts MEAL_INPUT_LANGUAGES */
internal class MealInputLanguage(val code: String, val flag: String, val speechLang: String, val nameDa: String, val nameEn: String)

internal object MealInputLanguages {
    val all = listOf(
        MealInputLanguage("da", "denmark", "da-DK", "Dansk", "Danish"),
        MealInputLanguage("sv", "sweden", "sv-SE", "Svensk", "Swedish"),
        MealInputLanguage("nb", "norway", "nb-NO", "Norsk", "Norwegian"),
        MealInputLanguage("de", "germany", "de-DE", "Tysk", "German"),
        MealInputLanguage("nl", "netherlands", "nl-NL", "Hollandsk", "Dutch"),
        MealInputLanguage("fr", "france", "fr-FR", "Fransk", "French"),
        MealInputLanguage("it", "italy", "it-IT", "Italiensk", "Italian"),
        MealInputLanguage("es", "spain", "es-ES", "Spansk", "Spanish"),
        MealInputLanguage("en", "united-kingdom", "en-GB", "Engelsk", "English"),
    )

    private val speechLangByRegion = mapOf(
        "DK" to "da-DK", "SE" to "sv-SE", "NO" to "nb-NO", "DE" to "de-DE", "AT" to "de-AT", "CH" to "de-CH",
        "NL" to "nl-NL", "BE" to "nl-BE", "FR" to "fr-FR", "IT" to "it-IT", "ES" to "es-ES", "GB" to "en-GB",
        "IE" to "en-IE", "US" to "en-US", "CA" to "en-CA", "AU" to "en-AU", "NZ" to "en-NZ",
    )

    private val regionFlag = mapOf(
        "AT" to "austria", "CH" to "switzerland", "BE" to "belgium", "US" to "usa",
        "CA" to "canada", "AU" to "australia", "NZ" to "new-zealand", "IE" to "ireland",
    )

    private const val STORAGE_KEY = "hf-meal-input-language"

    fun get(code: String): MealInputLanguage = all.firstOrNull { it.code == code } ?: all.first()

    private fun primary(tag: String) = tag.lowercase().split('-', '_').first()

    private fun regionSpeech(region: String?): String = speechLangByRegion[region ?: "DK"] ?: "da-DK"

    fun default(region: String?): String = primary(regionSpeech(region)).takeIf { p -> all.any { it.code == p } } ?: "da"

    fun speechLangFor(code: String, region: String?): String {
        val tag = regionSpeech(region)
        return if (primary(tag) == code) tag else get(code).speechLang
    }

    fun flagFor(code: String, region: String?): String {
        if (region != null && speechLangByRegion.containsKey(region) && default(region) == code) return regionFlag[region] ?: get(code).flag
        return get(code).flag
    }

    fun stored(): String? = NativeHooks.secureStorage.get(STORAGE_KEY)?.takeIf { s -> all.any { it.code == s } }

    fun store(code: String) = NativeHooks.secureStorage.set(STORAGE_KEY, code)
}

/** useMealInputLanguage(): the stored flag choice, else the region's language (region from /api/profile). */
internal class MealInputLanguageState {
    var region by mutableStateOf<String?>(null)
    var stored by mutableStateOf(MealInputLanguages.stored())
    val language: String get() = stored ?: MealInputLanguages.default(region)
    fun set(code: String) {
        MealInputLanguages.store(code)
        stored = code
    }
}

@Composable
internal fun rememberMealInputLanguage(): MealInputLanguageState {
    val state = remember { MealInputLanguageState() }
    LaunchedEffect(Unit) {
        runCatching {
            ((Api.get("/api/profile") as? JsonObject)?.get("user") as? JsonObject)?.get("region")?.jsonPrimitive?.contentOrNull
        }.getOrNull()?.let { state.region = it }
    }
    return state
}

/** src/components/voice/MealLanguagePicker.tsx — the flag in the header's left corner + a language sheet. */
@Composable
internal fun MealLanguagePicker(language: String, region: String?, onChange: (String) -> Unit) {
    val t = LocalTranslator.current
    var open by remember { mutableStateOf(false) }
    val danish = t.locale == Locale.Da
    Box(Modifier.size(44.dp).clickable { open = true }, contentAlignment = Alignment.Center) {
        HcRemoteImage(
            "/flags/${MealInputLanguages.flagFor(language, region)}.png",
            Modifier.width(28.dp).height(21.dp).clip(RoundedCornerShape(3.dp)),
            contentScale = ContentScale.Crop,
        )
    }
    if (open) {
        HcBottomSheet(onDismiss = { open = false }, title = t.t("voice.language.title")) {
            HcText(t.t("voice.language.hint"), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), color = HcColors.TextSecondary)
            Column {
                MealInputLanguages.all.forEach { option ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable {
                            onChange(option.code)
                            open = false
                        },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        HcRemoteImage("/flags/${MealInputLanguages.flagFor(option.code, region)}.png", Modifier.width(36.dp).height(27.dp).clip(RoundedCornerShape(2.dp)), contentScale = ContentScale.Crop)
                        HcText(if (danish) option.nameDa else option.nameEn, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                        if (option.code == language) HcIcon("Check", size = 20.dp, stroke = 2.5f, color = HcColors.Green)
                    }
                    CaptureLine()
                }
            }
        }
    }
}

/** One interpreted food from POST /api/ai/interpret-meal (also used by /chat). */
@Serializable
internal data class InterpretedItem(
    val title: String,
    val amountGrams: Double = 0.0,
    val amountLabel: String = "",
    val kcal: Double = 0.0,
    val protein: Double = 0.0,
    val carbs: Double = 0.0,
    val fat: Double = 0.0,
    val productId: String? = null,
    val image: String? = null,
    val estimated: Boolean = false,
)

@Serializable
internal data class InterpretedResponse(val items: List<InterpretedItem> = emptyList())

/** POST /api/registrations body for one interpreted item (+ shared meal). */
internal fun registrationBody(item: InterpretedItem): Map<String, Any> = buildMap {
    val productId = item.productId
    if (productId != null) {
        put("productId", productId)
        put("amountGrams", item.amountGrams)
    } else {
        put("amountGrams", item.amountGrams)
        put("titleSnapshot", item.title)
        put("kcalSnapshot", item.kcal)
        put("proteinSnapshot", item.protein)
        put("carbsSnapshot", item.carbs)
        put("fatSnapshot", item.fat)
    }
    putAll(MealShare.body())
}

/** A JS-style number for kcal labels ("120", "12.5"). */
internal fun jsNumber(value: Double): String = if (value == kotlin.math.floor(value)) value.toLong().toString() else value.toString()

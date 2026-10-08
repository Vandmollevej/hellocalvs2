package dk.packroff.hellocal.i18n

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.resources.Res
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import org.jetbrains.compose.resources.ExperimentalResourceApi

/**
 * Same texts and same lookup as the web app (src/i18n/index.ts): dot-path
 * keys, {token} interpolation, fallback to Danish, then the raw key. The
 * dictionaries are copied 1:1 from src/i18n/locales by scripts/native/sync.mjs.
 */
enum class Locale(val code: String, val intl: String, val displayName: String) {
    Da("da", "da-DK", "Dansk"),
    En("en", "en-GB", "English"),
    De("de", "de-DE", "Deutsch"),
    Fr("fr", "fr-FR", "Français"),
    Nl("nl", "nl-NL", "Nederlands"),
    Sv("sv", "sv-SE", "Svenska"),
    No("no", "nb-NO", "Norsk");

    companion object {
        val Default = Da
        fun from(code: String?): Locale = entries.firstOrNull { it.code == code } ?: Default
    }
}

class Translator(val locale: Locale, private val dictionary: JsonObject, private val fallback: JsonObject) {
    fun t(key: String, params: Map<String, Any> = emptyMap()): String {
        val value = resolve(dictionary, key) ?: resolve(fallback, key) ?: return key
        if (params.isEmpty()) return value
        return TOKEN.replace(value) { m -> params[m.groupValues[1]]?.toString() ?: m.value }
    }

    fun t(key: String, vararg params: Pair<String, Any>): String = t(key, params.toMap())

    /** True when the key exists (some web UI hides a row when its text is missing). */
    fun has(key: String): Boolean = resolve(dictionary, key) != null || resolve(fallback, key) != null

    private fun resolve(root: JsonObject, key: String): String? {
        var node: JsonElement = root
        for (segment in key.split('.')) {
            node = (node as? JsonObject)?.get(segment) ?: return null
        }
        return (node as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull
    }

    companion object {
        private val TOKEN = Regex("\\{(\\w+)\\}")
        val Empty = Translator(Locale.Default, JsonObject(emptyMap()), JsonObject(emptyMap()))
    }
}

object Dictionaries {
    private val cache = mutableMapOf<Locale, JsonObject>()
    private val json = Json { ignoreUnknownKeys = true }

    @OptIn(ExperimentalResourceApi::class)
    suspend fun load(locale: Locale): JsonObject = cache.getOrPut(locale) {
        json.parseToJsonElement(Res.readBytes("files/locales/${locale.code}.json").decodeToString()) as JsonObject
    }

    suspend fun translator(locale: Locale): Translator = Translator(locale, load(locale), load(Locale.Default))
}

val LocalTranslator = compositionLocalOf { Translator.Empty }

/**
 * The app language (src/i18n/LocaleProvider.tsx). Before login it comes from
 * the device ("hello-cal-locale", set by the login country picker); once logged
 * in the profile's appLocale wins. Changing it switches every screen at once.
 */
object AppLocale {
    const val STORAGE_KEY = "hello-cal-locale"

    var current by mutableStateOf(Locale.Default)
        private set

    fun isLocale(code: String?): Boolean = Locale.entries.any { it.code == code }

    /** Start-up: the stored choice, else [fallback] (e.g. the stored login country), else Danish. */
    fun init(fallback: () -> String?) {
        val stored = runCatching { NativeHooks.secureStorage.get(STORAGE_KEY) }.getOrNull()
        val code = stored?.takeIf { isLocale(it) } ?: fallback()?.takeIf { isLocale(it) }
        current = Locale.from(code)
    }

    /** web setLocale(): switches the app language; [persist] keeps it on the device for the next start. */
    fun set(code: String?, persist: Boolean = true) {
        if (!isLocale(code)) return
        current = Locale.from(code)
        if (persist) runCatching { NativeHooks.secureStorage.set(STORAGE_KEY, current.code) }
    }
}

/**
 * Loads the dictionary for [locale] and recomposes when it is ready. While a
 * new language loads, the previous dictionary stays in use (no blank screen).
 */
@Composable
fun rememberTranslator(locale: Locale): Translator? {
    var translator by remember { mutableStateOf<Translator?>(null) }
    LaunchedEffect(locale) { translator = Dictionaries.translator(locale) }
    return translator
}

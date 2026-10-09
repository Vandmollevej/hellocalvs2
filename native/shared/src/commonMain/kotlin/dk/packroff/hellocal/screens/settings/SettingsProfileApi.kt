package dk.packroff.hellocal.screens.settings

import dk.packroff.hellocal.api.Api
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject

// GET/PATCH /api/profile (src/app/api/profile/route.ts) — the settings pages
// read single fields from `user` and save each change at once (no Save button).

/** GET /api/profile → the `user` object; throws on network/HTTP errors. */
suspend fun settingsLoadProfile(): JsonObject = Api.get("/api/profile").jsonObject["user"]?.let { it as? JsonObject } ?: JsonObject(emptyMap())

/** PATCH /api/profile, fire-and-forget like the web's `.catch(() => {})`. */
suspend fun settingsPatchProfile(body: Map<String, Any?>) {
    runCatching { Api.patch("/api/profile", body) }
}

internal fun JsonObject.settingsBool(key: String): Boolean? = (this[key] as? JsonPrimitive)?.booleanOrNull
internal fun JsonObject.settingsStr(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull
internal fun JsonObject.settingsNum(key: String): Double? = (this[key] as? JsonPrimitive)?.doubleOrNull
internal fun JsonObject.settingsObj(key: String): JsonObject? = this[key] as? JsonObject

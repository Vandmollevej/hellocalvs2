package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.ui.CaptureDates
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.minus
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

// Screeninger (docs/DECISIONS.md 2026-10-09): models and API calls mirrored from
// src/lib/screenings.ts and src/lib/screenings-client.ts.

data class ScreeningQuestion(val id: String, val text: String)

data class Screening(
    val id: String,
    val presetKey: String?,
    val name: String,
    val purpose: String,
    val frequency: String,
    val questions: List<ScreeningQuestion>,
    val notificationsEnabled: Boolean,
    val notificationTime: String?,
    val scale: String,
    val inputType: String,
    val notesEnabled: Boolean,
    val minLabel: String,
    val maxLabel: String,
    val showInCalendar: Boolean,
    val active: Boolean,
)

data class ScreeningEntry(val id: String, val screeningId: String, val date: String, val value: Double, val note: String?)

val SCREENING_FREQUENCIES = listOf("DAILY", "WEEKLY", "MONTHLY", "MANUAL")
val SCREENING_SCALES = listOf("FIVE", "TEN", "PERCENT")
val SCREENING_INPUT_TYPES = listOf("BUTTONS", "SLIDER", "INPUT", "STEPPER")
val SCREENING_PERIODS = listOf("7", "30", "90", "365")
val SCREENING_PRESET_KEYS = listOf("migraine", "stomachPain", "mood")
const val SCREENING_MAX_QUESTIONS = 10

data class ScreeningRange(val min: Int, val max: Int, val step: Int)

fun screeningRange(scale: String): ScreeningRange = when (scale) {
    "FIVE" -> ScreeningRange(1, 5, 1)
    "TEN" -> ScreeningRange(1, 10, 1)
    else -> ScreeningRange(0, 100, 5)
}

fun formatScreeningValue(value: Double, scale: String): String {
    val rounded = kotlin.math.round(value * 10) / 10
    val text = if (rounded % 1.0 == 0.0) rounded.toInt().toString() else rounded.toString()
    return if (scale == "PERCENT") "$text %" else text
}

private fun JsonElement?.str(): String? = (this as? JsonPrimitive)?.contentOrNull
private fun JsonElement?.bool(): Boolean? = (this as? JsonPrimitive)?.booleanOrNull

fun parseScreening(obj: JsonObject): Screening? {
    val id = obj["id"].str() ?: return null
    val questions = (obj["questions"] as? JsonArray).orEmpty().mapNotNull {
        val q = it as? JsonObject ?: return@mapNotNull null
        ScreeningQuestion(q["id"].str() ?: return@mapNotNull null, q["text"].str() ?: "")
    }
    return Screening(
        id = id,
        presetKey = obj["presetKey"].str(),
        name = obj["name"].str() ?: "",
        purpose = obj["purpose"].str() ?: "",
        frequency = obj["frequency"].str() ?: "DAILY",
        questions = questions,
        notificationsEnabled = obj["notificationsEnabled"].bool() ?: false,
        notificationTime = obj["notificationTime"].str(),
        scale = obj["scale"].str() ?: "TEN",
        inputType = obj["inputType"].str() ?: "SLIDER",
        notesEnabled = obj["notesEnabled"].bool() ?: true,
        minLabel = obj["minLabel"].str() ?: "",
        maxLabel = obj["maxLabel"].str() ?: "",
        showInCalendar = obj["showInCalendar"].bool() ?: false,
        active = obj["active"].bool() ?: true,
    )
}

fun parseScreeningEntry(obj: JsonObject): ScreeningEntry? {
    return ScreeningEntry(
        id = obj["id"].str() ?: return null,
        screeningId = obj["screeningId"].str() ?: return null,
        date = obj["date"].str() ?: return null,
        value = (obj["value"] as? JsonPrimitive)?.doubleOrNull ?: 0.0,
        note = obj["note"].str(),
    )
}

object ScreeningApi {
    /** Loads the screenings; the first time, migraine, stomach pain and mood are created in the user's language. */
    suspend fun load(t: Translator): List<Screening> {
        var data = Api.get("/api/screenings").jsonObject
        if (data["seeded"].bool() != true) {
            val texts = buildJsonObject {
                for (key in SCREENING_PRESET_KEYS) {
                    put(key, buildJsonObject {
                        put("name", t.t("screenings.presets.$key.name"))
                        put("purpose", t.t("screenings.presets.$key.purpose"))
                        put("question", t.t("screenings.presets.$key.question"))
                        put("min", t.t("screenings.presets.$key.min"))
                        put("max", t.t("screenings.presets.$key.max"))
                    })
                }
            }
            Api.post("/api/screenings/seed", buildJsonObject { put("texts", texts) })
            data = Api.get("/api/screenings").jsonObject
        }
        return (data["screenings"] as? JsonArray).orEmpty().mapNotNull { parseScreening(it.jsonObject) }
    }

    suspend fun entriesInRange(from: String, to: String): List<ScreeningEntry> =
        (Api.get("/api/screenings/entries?from=$from&to=$to").jsonObject["entries"] as? JsonArray).orEmpty()
            .mapNotNull { parseScreeningEntry(it.jsonObject) }

    suspend fun entries(id: String): List<ScreeningEntry> =
        (Api.get("/api/screenings/$id/entries").jsonObject["entries"] as? JsonArray).orEmpty()
            .mapNotNull { parseScreeningEntry(it.jsonObject) }

    suspend fun saveEntry(screeningId: String, answers: Map<String, Int>, note: String?) {
        Api.put(
            "/api/screenings/$screeningId/entries",
            buildJsonObject {
                put("date", today())
                put("answers", buildJsonObject { answers.forEach { (k, v) -> put(k, v) } })
                put("note", note)
            },
        )
    }

    suspend fun setActive(id: String, active: Boolean) {
        Api.patch("/api/screenings/$id", buildJsonObject { put("active", active) })
    }

    suspend fun delete(id: String) {
        Api.delete("/api/screenings/$id")
    }

    suspend fun save(existingId: String?, draft: Screening) {
        val body = buildJsonObject {
            put("name", draft.name.trim())
            put("purpose", draft.purpose.trim())
            put("frequency", draft.frequency)
            put(
                "questions",
                JsonArray(draft.questions.filter { it.text.isNotBlank() }.map { q ->
                    buildJsonObject { put("id", q.id); put("text", q.text.trim()) }
                }),
            )
            put("notificationsEnabled", draft.notificationsEnabled)
            put("notificationTime", if (draft.notificationsEnabled) draft.notificationTime else null)
            put("scale", draft.scale)
            put("inputType", draft.inputType)
            put("notesEnabled", draft.notesEnabled)
            put("minLabel", draft.minLabel)
            put("maxLabel", draft.maxLabel)
            put("showInCalendar", draft.showInCalendar)
        }
        if (existingId == null) Api.post("/api/screenings", body) else Api.patch("/api/screenings/$existingId", body)
    }

    fun today(): String = CaptureDates.isoDate(CaptureDates.today())
    fun daysAgo(days: Int): String = CaptureDates.isoDate(CaptureDates.today().minus(days, DateTimeUnit.DAY))
}

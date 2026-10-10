package dk.packroff.hellocal.screens.settings

import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.ui.SettingsHelloDocDailyNutrition
import dk.packroff.hellocal.ui.SettingsHelloDocFluidPoint
import dk.packroff.hellocal.ui.SettingsHelloDocProfile
import dk.packroff.hellocal.ui.SettingsHelloDocSleep
import dk.packroff.hellocal.ui.SettingsHelloDocWeightPoint
import dk.packroff.hellocal.ui.CaptureDates
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlin.math.ceil

// Hello Doc (docs/DECISIONS.md 2026-09-12) — native counterpart of
// src/lib/doctor-share.ts plus the JSON shapes of /api/doctor-shares/…

/** One DoctorShare row as returned by /api/doctor-shares and /api/doctor-shares/[id]. */
@Serializable
data class SettingsHelloDocShareDto(
    val id: String,
    val token: String = "",
    val name: String = "",
    val email: String = "",
    /** "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED" */
    val status: String = "PENDING",
    val categories: JsonElement? = null,
    val historyRange: String = "ALL",
    val expiresAt: String? = null,
)

/** GET /api/doctor-shares → { shares } */
@Serializable
data class SettingsHelloDocSharesResponse(val shares: List<SettingsHelloDocShareDto> = emptyList())

/** GET/PATCH /api/doctor-shares/[id], POST …/renew, …/revoke → { share } */
@Serializable
data class SettingsHelloDocShareResponse(val share: SettingsHelloDocShareDto)

/** GET /api/doctor-shares/preview?range=… (src/lib/doctor-share-data.ts DoctorShareOwnerData + range). */
@Serializable
data class SettingsHelloDocPreviewDto(
    val profile: SettingsHelloDocProfile? = null,
    val startWeightKg: Double? = null,
    val startWeightRecordedAt: String = "",
    val targetWeightKg: Double? = null,
    val sleep: SettingsHelloDocSleep? = null,
    val weightHistory: List<SettingsHelloDocWeightPoint> = emptyList(),
    val fluidHistory: List<SettingsHelloDocFluidPoint> = emptyList(),
    val dailyNutrition: List<SettingsHelloDocDailyNutrition> = emptyList(),
    val range: String = "ALL",
)

/** src/lib/doctor-share.ts constants and helpers. */
object SettingsHelloDoc {
    val Categories = listOf(
        "profile",
        "weight",
        "goals",
        "menstrualCycle",
        "digestion",
        "sleep",
        "foodAndCalories",
        "vitaminsMinerals",
        "fluid",
    )

    /** No data source yet: shown disabled, never a real toggle. */
    val UnavailableCategories = listOf("menstrualCycle", "digestion")

    val DefaultCategories: List<String> = Categories.filter { it !in UnavailableCategories }

    val CategoryLabelKey = mapOf(
        "profile" to "helloDoc.categoryProfile",
        "weight" to "helloDoc.categoryWeight",
        "goals" to "helloDoc.categoryGoals",
        "menstrualCycle" to "helloDoc.categoryMenstrualCycle",
        "digestion" to "helloDoc.categoryDigestion",
        "sleep" to "helloDoc.categorySleep",
        "foodAndCalories" to "helloDoc.categoryFoodAndCalories",
        "vitaminsMinerals" to "helloDoc.categoryVitaminsMinerals",
        "fluid" to "helloDoc.categoryFluid",
    )

    /** digestion is "kommer senere"; the other unavailable ones use helloDoc.categoryUnavailable. */
    val UnavailableLabelKey = mapOf("digestion" to "helloDoc.categoryComingSoon")

    val HistoryRanges = listOf("LAST_7_DAYS", "LAST_MONTH", "LAST_YEAR", "ALL")

    val HistoryLabelKey = mapOf(
        "LAST_7_DAYS" to "helloDoc.historyLast7Days",
        "LAST_MONTH" to "helloDoc.historyLastMonth",
        "LAST_YEAR" to "helloDoc.historyLastYear",
        "ALL" to "helloDoc.historyAll",
    )

    fun historyLabelKey(range: String): String = HistoryLabelKey[range] ?: "helloDoc.historyAll"

    fun categoryLabelKey(category: String): String = CategoryLabelKey[category] ?: category

    /** sanitizeDoctorShareCategories(): known keys only, defaults when empty/invalid. */
    fun sanitizeCategories(value: JsonElement?): List<String> {
        val array = value as? JsonArray ?: return DefaultCategories
        val filtered = array.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }.filter { it in Categories }
        return filtered.ifEmpty { DefaultCategories }
    }

    fun parseInstant(value: String?): Instant? =
        if (value.isNullOrBlank()) null else runCatching { Instant.parse(value) }.getOrNull()

    /** doctorShareDurationLabel(): duration/expiry shown in the list and on the edit screen. */
    fun durationLabel(share: SettingsHelloDocShareDto, t: Translator): String {
        if (share.status == "REVOKED") return t.t("helloDoc.statusRevoked")
        if (share.status == "EXPIRED") return t.t("helloDoc.expired")
        val expires = parseInstant(share.expiresAt)
        if (share.status == "ACTIVE" && expires == null) return t.t("helloDoc.permanent")
        if (expires == null) return t.t("helloDoc.pending")

        val msLeft = (expires - Clock.System.now()).inWholeMilliseconds
        if (msLeft <= 0) return t.t("helloDoc.expired")
        val daysLeft = ceil(msLeft / (24.0 * 60 * 60 * 1000)).toInt()
        return if (daysLeft <= 1) t.t("helloDoc.expiresToday") else t.t("helloDoc.expiresIn", "days" to daysLeft)
    }

    /** web: toDateInput() — the stored expiry as "YYYY-MM-DD" in local time, "" = no expiry. */
    fun expiryDateInput(iso: String?): String {
        val local = CaptureDates.local(iso) ?: return ""
        return CaptureDates.isoDate(local.date)
    }

    /** Edit screen: still has access → "Fjern adgang", otherwise "Forny adgang". */
    fun hasAccess(share: SettingsHelloDocShareDto): Boolean {
        if (share.status == "ACTIVE") return true
        if (share.status != "PENDING") return false
        val expires = parseInstant(share.expiresAt) ?: return true
        return expires > Clock.System.now()
    }

    /** web: `data.message ?? t("helloDoc.errorGeneric")`. */
    fun errorMessage(e: Throwable, fallback: String): String {
        val body = (e as? ApiException)?.body as? JsonObject ?: return fallback
        return (body["message"] as? JsonPrimitive)?.contentOrNull ?: fallback
    }
}

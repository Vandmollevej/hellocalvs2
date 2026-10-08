package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.formatNumber
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.datetime.LocalDate
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

// Shared by the goal screens (src/lib/goal-format.ts, body-measurements.ts,
// goal-composition.ts, goal-nutrition.ts — display helpers only).

/** BODY_MEASUREMENT_FIELDS: field, label key, name key, drawing name (null = no approved drawing). */
data class BodyField(val field: String, val labelKey: String, val nameKey: String, val drawing: String?)

val BODY_MEASUREMENT_FIELDS = listOf(
    BodyField("chestCm", "bodyMeasurements.chest", "bodyMeasurements.names.chest", "chest"),
    BodyField("waistCm", "bodyMeasurements.waist", "bodyMeasurements.names.waist", "waist"),
    BodyField("hipCm", "bodyMeasurements.hip", "bodyMeasurements.names.hip", null),
    BodyField("upperArmCm", "bodyMeasurements.upperArm", "bodyMeasurements.names.upperArm", "arm"),
    BodyField("thighCm", "bodyMeasurements.thigh", "bodyMeasurements.names.thigh", "leg"),
)

/** COMPOSITION_GOAL_FIELDS and NUTRITION_GOAL_FIELDS: field, unit, name key. */
data class GoalField(val field: String, val unit: String, val nameKey: String)

val COMPOSITION_GOAL_FIELDS = listOf(
    GoalField("bodyFatPercent", "%", "goals.composition.bodyFatPercent"),
    GoalField("muscleMassKg", "kg", "goals.composition.muscleMassKg"),
)

val NUTRITION_GOAL_FIELDS = listOf(
    GoalField("kcal", "kcal", "goals.nutrition.kcal"),
    GoalField("proteinG", "g", "goals.nutrition.proteinG"),
    GoalField("carbsG", "g", "goals.nutrition.carbsG"),
    GoalField("fatG", "g", "goals.nutrition.fatG"),
)

object GoalFormat {
    fun targetNameKey(type: String): String = when {
        type == "weight" -> "goals.weight"
        else -> BODY_MEASUREMENT_FIELDS.firstOrNull { it.field == type }?.nameKey
            ?: COMPOSITION_GOAL_FIELDS.firstOrNull { it.field == type }?.nameKey
            ?: NUTRITION_GOAL_FIELDS.firstOrNull { it.field == type }?.nameKey
            ?: type
    }

    fun value(value: Double): String = formatNumber(value, 1, minDecimals = 0)

    private fun isNutrition(type: String) = NUTRITION_GOAL_FIELDS.any { it.field == type }

    /** Nutrition goals are daily guides and never "reached" by a measurement. */
    fun isCompleted(goal: Goal): Boolean {
        val measurable = goal.targets.filter { !isNutrition(it.type) }
        return measurable.isNotEmpty() && measurable.all { it.completedAt != null }
    }

    /** weight | body | nutrition */
    fun category(type: String): String = when {
        type == "weight" -> "weight"
        BODY_MEASUREMENT_FIELDS.any { it.field == type } || COMPOSITION_GOAL_FIELDS.any { it.field == type } -> "body"
        else -> "nutrition"
    }

    fun categories(goal: Goal): List<String> {
        val present = goal.targets.map { category(it.type) }.toSet()
        return listOf("weight", "body", "nutrition").filter { it in present }
    }

    /** Upcoming = not reached and with a target date from today on; nearest first. */
    fun upcoming(goals: List<Goal>, todayIso: String): List<Goal> =
        goals.filter { !isCompleted(it) && it.targetDate != null && it.targetDate >= todayIso }.sortedBy { it.targetDate }
}

object GoalsApi {
    suspend fun list(): List<Goal> {
        val goals = (Api.get("/api/goals") as JsonObject)["goals"] ?: return emptyList()
        return ApiJson.decodeFromJsonElement(ListSerializer(Goal.serializer()), goals)
    }

    /** null when the goal does not exist (404). */
    suspend fun get(id: String): Goal? {
        return try {
            val goal = (Api.get("/api/goals/${dk.packroff.hellocal.nav.Location.encode(id)}") as JsonObject)["goal"] ?: return null
            ApiJson.decodeFromJsonElement(Goal.serializer(), goal)
        } catch (e: dk.packroff.hellocal.api.ApiException) {
            if (e.status == 404) null else throw e
        }
    }
}

/** src/components/hf/GoalDateSquare.tsx — white square with the day and month; green when reached. */
@Composable
fun GoalDateSquare(date: LocalDate, completed: Boolean = false) {
    val shape = RoundedCornerShape(8.dp)
    Column(
        Modifier.size(44.dp).clip(shape).background(if (completed) HcColors.Green else HcColors.White, shape)
            .border(1.dp, if (completed) HcColors.Green else HcColors.Gray, shape),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        HcText(date.dayOfMonth.toString(), HcTypeRoles.Body, bold = true, color = if (completed) HcColors.White else HcColors.Black)
        HcText(ProfileDates.monthAbbrev(date).uppercase(), HcTypeRoles.Micro, bold = true, color = HcColors.TextSecondary)
    }
}

/** src/lib/use-subscription-tier.ts — fetched once and shared. */
object SubscriptionTier {
    var cached: String? = null
        private set

    suspend fun load(): String {
        cached?.let { return it }
        val tier = runCatching { (Api.get("/api/subscription") as JsonObject)["tier"]?.jsonPrimitive?.contentOrNull }.getOrNull() ?: "FREE"
        cached = tier
        return tier
    }
}

/**
 * src/components/PremiumGate.tsx — Seriøs-only pages: free users see a short
 * explanation and the way to Seriøs instead of the page.
 */
@Composable
fun ProfilePremiumGate(titleKey: String, content: @Composable () -> Unit) {
    val t = LocalTranslator.current
    var tier by remember { mutableStateOf(SubscriptionTier.cached) }
    LaunchedEffect(Unit) { tier = SubscriptionTier.load() }
    if (tier == "SERIOUS") {
        content()
        return
    }
    HcScreen(title = t.t(titleKey)) {
        if (tier == "FREE") ProfilePremiumUpsell()
    }
}

@Composable
fun ProfilePremiumUpsell() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        val shape = RoundedCornerShape(8.dp)
        Column(
            Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            HcIcon("Lock", size = 28.dp, color = HcColors.Black)
            HcText(t.t("premium.title"), HcTypeRoles.SectionTitle, align = androidx.compose.ui.text.style.TextAlign.Center)
            HcText(t.t("premium.description"), HcTypeRoles.Body, color = HcColors.TextSecondary, align = androidx.compose.ui.text.style.TextAlign.Center)
        }
        HcButton(t.t("premium.cta"), onClick = { nav.push("/profile/subscription/serious") })
    }
}

/** A green circle with a white check (reached target). */
@Composable
fun GoalReachedBadge() {
    Box(Modifier.size(24.dp).clip(RoundedCornerShape(50)).background(HcColors.Green), contentAlignment = Alignment.Center) {
        HcIcon("Check", size = 16.dp, stroke = 3f, color = HcColors.White)
    }
}

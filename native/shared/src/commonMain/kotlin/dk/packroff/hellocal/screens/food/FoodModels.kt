package dk.packroff.hellocal.screens.food

import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.Translator
import kotlinx.datetime.Clock
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.minus
import kotlinx.datetime.offsetAt
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull

// JSON shapes of the /api routes the food screens use (src/app/api/**/route.ts).

@Serializable
data class ProductBrand(val name: String = "", val logoUrl: String? = null)

@Serializable
data class TaggedImage(val url: String = "", val tags: List<String> = emptyList())

@Serializable
data class CertificationFilters(
    val organic: String? = null,
    val keyhole: String? = null,
    val wholeGrain: String? = null,
    val animalWelfare: List<String>? = null,
    val certifications: List<String>? = null,
)

@Serializable
data class ProductLabelView(
    val key: String = "",
    val name: String = "",
    val category: String? = null,
    val imageUrl: String? = null,
    val confidence: Double = 0.0,
)

@Serializable
data class ProductBarcode(val code: String = "")

@Serializable
data class ResolvedNutrient(
    val key: String = "",
    val per100g: Double = 0.0,
    val estimated: Boolean = false,
    val tolerancePer100g: Double? = null,
)

@Serializable
data class AlternativeServing(
    val label: String = "",
    val amount: Double? = null,
    val unit: String? = null,
    val kcal: Double? = null,
    val confidence: Double = 0.0,
)

@Serializable
data class UpdateOffer(val kinds: List<String> = emptyList(), val points: Int = 20)

@Serializable
data class RecipeDetails(val websiteUrl: String? = null)

/** GET /api/products/[id] → product (also the GenericIngredient fallback shape). */
@Serializable
data class ProductDto(
    val id: String = "",
    val name: String = "",
    val kcalPer100g: Double = 0.0,
    val proteinPer100g: Double = 0.0,
    val carbsPer100g: Double = 0.0,
    val fatPer100g: Double = 0.0,
    val servingSizeGrams: Double? = null,
    val servingSizeUnitSingular: String? = null,
    val servingSizeUnitPlural: String? = null,
    val brand: ProductBrand? = null,
    // Product line shown above the brand by the circle — as a logo when one exists (DECISIONS 2026-10-10).
    val subbrand: String? = null,
    val subbrandLogoUrl: String? = null,
    val productCategory: String? = null,
    val packageSizeText: String? = null,
    val variant: String? = null,
    val flavor: String? = null,
    val productType: String? = null,
    val imageUrl: String? = null,
    val pendingImageUrl: String? = null,
    val pendingFields: List<String> = emptyList(),
    val createdAt: String? = null,
    val images: List<TaggedImage> = emptyList(),
    val ingredientsText: String? = null,
    val ingredientsUnreadable: Boolean = false,
    val updateOffer: UpdateOffer? = null,
    val allergens: List<String> = emptyList(),
    val additives: List<String> = emptyList(),
    val filters: CertificationFilters? = null,
    val labels: List<ProductLabelView> = emptyList(),
    val barcodes: List<ProductBarcode> = emptyList(),
    val createdByUserId: String? = null,
    val externalSource: String? = null,
    val recipeDetails: RecipeDetails? = null,
    val privateOwnerId: String? = null,
    val nutritionExtra: JsonElement? = null,
    val saturatedFatPer100g: Double? = null,
    val unsaturatedFatPer100g: Double? = null,
    val transFatPer100g: Double? = null,
    val cholesterolPer100g: Double? = null,
    val vitaminAPer100g: Double? = null,
    val vitaminCPer100g: Double? = null,
    val alternativeServings: List<AlternativeServing>? = null,
    val isGenericIngredient: Boolean = false,
    val hasKnownNutrition: Boolean? = null,
    val nutrients: List<ResolvedNutrient> = emptyList(),
    // Frida-skøn (docs/DECISIONS.md 2026-10-10): ∼ ved kalorietallet og Fridas kildeangivelse.
    val kcalEstimated: Boolean = false,
    val fridaSource: Boolean = false,
    val keywords: JsonElement? = null,
    val dietaryTags: JsonElement? = null,
    val lastAmountGrams: Double? = null,
) {
    /** Product.nutritionExtra as numbers (HelloFresh extras, per servingSizeGrams). */
    fun extraNumber(key: String): Double? =
        ((nutritionExtra as? JsonObject)?.get(key) as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull

    fun keywordList(): List<String> = (keywords as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()
}

@Serializable
data class ProductResponse(val product: ProductDto? = null)

@Serializable
data class RegistrationProductInfo(
    val imageUrl: String? = null,
    val servingSizeGrams: Double? = null,
    val servingSizeUnitSingular: String? = null,
    val servingSizeUnitPlural: String? = null,
)

/** One registration (GET /api/registrations, GET /api/registrations/[id]). */
@Serializable
data class RegistrationDto(
    val id: String = "",
    val titleSnapshot: String = "",
    val kcalSnapshot: Double = 0.0,
    val proteinSnapshot: Double = 0.0,
    val carbsSnapshot: Double = 0.0,
    val fatSnapshot: Double = 0.0,
    val sugarSnapshot: Double? = null,
    val fiberSnapshot: Double? = null,
    val saltSnapshot: Double? = null,
    val potassiumSnapshot: Double? = null,
    val calciumSnapshot: Double? = null,
    val ironSnapshot: Double? = null,
    val saturatedFatSnapshot: Double? = null,
    val unsaturatedFatSnapshot: Double? = null,
    val transFatSnapshot: Double? = null,
    val cholesterolSnapshot: Double? = null,
    val vitaminASnapshot: Double? = null,
    val vitaminCSnapshot: Double? = null,
    /** Every nutrient in src/lib/nutrients.ts (per registration); used by the user's own wheel measurements. */
    val nutrientSnapshot: Map<String, Double>? = null,
    val amountGrams: Double = 0.0,
    val createdAt: String = "",
    val productId: String? = null,
    val genericIngredientId: String? = null,
    val product: RegistrationProductInfo? = null,
)

@Serializable
data class RegistrationsResponse(val registrations: List<RegistrationDto> = emptyList())

@Serializable
data class RegistrationResponse(val registration: RegistrationDto? = null)

@Serializable
data class FavoriteProductRef(val id: String = "", val name: String = "", val imageUrl: String? = null)

@Serializable
data class FavoriteDto(val id: String = "", val product: FavoriteProductRef? = null)

@Serializable
data class FavoritesResponse(val favorites: List<FavoriteDto> = emptyList())

/** GET /api/profile → user (only the fields the food screens read). */
@Serializable
data class FoodProfileUser(
    val id: String = "",
    val sex: String? = null,
    val cycleTrackingEnabled: Boolean = false,
    val showAllergens: Boolean = false,
    val allergenVisibility: JsonElement? = null,
    val showExtendedNutrition: Boolean = false,
    val autoExpandUncertainty: Boolean = false,
    val showAdditives: Boolean = false,
    val showToxins: Boolean = false,
    val region: String? = null,
) {
    /** allergenVisibility[key] !== false */
    fun allergenVisible(key: String): Boolean = allergenVisibility.bool(key) != false
}

@Serializable
data class FoodProfileResponse(val user: FoodProfileUser? = null)

@Serializable
data class PhotoAward(val id: String = "", val photoType: String = "", val points: Int = 0)

@Serializable
data class PhotoAwardsResponse(val awards: List<PhotoAward> = emptyList())

/** GET /api/products?q= and /api/products/most-used rows. */
@Serializable
data class ProductListItem(
    val id: String = "",
    val name: String = "",
    /** Search hits only: "Brand Subbrand Name" (src/lib/search-result-title.ts). */
    val searchTitle: String? = null,
    val imageUrl: String? = null,
    val kcalPer100g: Double = 0.0,
    val proteinPer100g: Double = 0.0,
    val carbsPer100g: Double = 0.0,
    val fatPer100g: Double = 0.0,
    val brand: ProductBrand? = null,
    val nutrientSources: JsonElement? = null,
    val nutritionMissing: Boolean = false,
)

@Serializable
data class ProductListResponse(
    val products: List<ProductListItem> = emptyList(),
    val profileId: String? = null,
    val correctedQuery: String? = null,
    val originalQuery: String? = null,
    val suggestedQuery: String? = null,
)

/** src/lib/user-scans.ts UserScan. */
@Serializable
data class UserScan(
    val id: String = "",
    val name: String = "",
    val imageUrl: String? = null,
    val brand: String? = null,
    val kcalPer100g: Double = 0.0,
    val macrosEstimated: Boolean = false,
    val createdAt: String = "",
    val added: Boolean = false,
)

@Serializable
data class UserScansResponse(val scans: List<UserScan> = emptyList())

// ---------------------------------------------------------------------------
// Dates (local time like the web's `new Date()` getters).

object FoodTime {
    val zone: TimeZone get() = TimeZone.currentSystemDefault()

    fun now(): Instant = Clock.System.now()

    fun parse(iso: String?): Instant? = iso?.let { runCatching { Instant.parse(it) }.getOrNull() }

    fun local(instant: Instant): LocalDateTime = instant.toLocalDateTime(zone)

    fun today(): LocalDate = local(now()).date

    fun isToday(iso: String?): Boolean = parse(iso)?.let { local(it).date == today() } ?: false

    fun two(n: Int) = n.toString().padStart(2, '0')

    /** "HH:mm" (Intl hour/minute 2-digit). */
    fun hhmm(instant: Instant): String = local(instant).let { "${two(it.hour)}:${two(it.minute)}" }

    fun hhmm(iso: String?): String = parse(iso)?.let(::hhmm) ?: ""

    fun currentTimeString(): String = hhmm(now())

    fun dateString(date: LocalDate): String = "${date.year}-${two(date.monthNumber)}-${two(date.dayOfMonth)}"

    fun currentDateString(): String = dateString(today())

    fun dateString(instant: Instant): String = dateString(local(instant).date)

    /** "yyyy-MM-dd" + "HH:mm" in local time → Instant. */
    fun toInstant(date: String, time: String): Instant? = runCatching {
        val (y, m, d) = date.split("-").map { it.trim().toInt() }
        val (h, min) = time.split(":").map { it.trim().toInt() }
        LocalDateTime(y, m, d, h, min).toInstant(zone)
    }.getOrNull()

    /** Minutes east of UTC (src/lib/daily-budget.ts clientTzOffsetMinutesEast). */
    fun tzOffsetMinutesEast(): Int = zone.offsetAt(now()).totalSeconds / 60

    fun yesterday(): LocalDate = today().minus(1, DateTimeUnit.DAY)

    private val months = mapOf(
        Locale.Da to listOf("januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"),
        Locale.No to listOf("januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"),
        Locale.Sv to listOf("januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"),
        Locale.De to listOf("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"),
        Locale.Nl to listOf("januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"),
        Locale.Fr to listOf("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"),
        Locale.En to listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"),
    )

    private val weekdays = mapOf(
        Locale.Da to listOf("mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"),
        Locale.No to listOf("mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"),
        Locale.Sv to listOf("måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"),
        Locale.De to listOf("Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"),
        Locale.Nl to listOf("maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"),
        Locale.Fr to listOf("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"),
        Locale.En to listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"),
    )

    /** Intl { weekday: "long", day: "numeric", month: "long" (, year) } in the app locale. */
    fun longDate(date: LocalDate, locale: Locale, withYear: Boolean): String {
        val weekday = weekdays.getValue(locale)[date.dayOfWeek.isoDayNumber - 1]
        val month = months.getValue(locale)[date.monthNumber - 1]
        val day = date.dayOfMonth
        val year = if (withYear) " ${date.year}" else ""
        return when (locale) {
            Locale.Da -> "$weekday den $day. $month$year"
            Locale.No -> "$weekday $day. $month$year"
            Locale.De -> "$weekday, $day. $month$year"
            else -> "$weekday $day $month$year"
        }
    }
}

// ---------------------------------------------------------------------------

/** src/lib/use-online-status.ts useConnectionMessage: offline → the offline text. */
fun connectionMessage(t: Translator, error: Throwable?, fallback: String): String =
    if (error != null && error !is ApiException) t.t("offline.message") else fallback

/** JSON helpers for small responses. */
fun JsonElement?.str(key: String): String? = ((this as? JsonObject)?.get(key) as? JsonPrimitive)?.contentOrNull

fun JsonElement?.num(key: String): Double? = ((this as? JsonObject)?.get(key) as? JsonPrimitive)?.doubleOrNull

fun JsonElement?.bool(key: String): Boolean? = ((this as? JsonObject)?.get(key) as? JsonPrimitive)?.booleanOrNull

fun JsonElement?.obj(key: String): JsonObject? = (this as? JsonObject)?.get(key) as? JsonObject

fun JsonElement?.arr(key: String): JsonArray? = (this as? JsonObject)?.get(key) as? JsonArray

/** encodeURIComponent for path segments and query values. */
fun encodeUri(value: String): String = dk.packroff.hellocal.nav.Location.encode(value)

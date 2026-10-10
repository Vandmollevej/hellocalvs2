package dk.packroff.hellocal.screens.food

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * The web keeps a few things in sessionStorage (dish draft, shared-meal
 * choice) and localStorage (front-page layout choices). Native: session data
 * lives in memory for the app process, device preferences in
 * NativeHooks.secureStorage under the SAME key names as the web's localStorage.
 */

// ---------------------------------------------------------------------------
// src/lib/dish-draft.ts

@Serializable
data class DishDraftIngredient(
    val productId: String,
    val name: String,
    val imageUrl: String? = null,
    val kcalPer100g: Double = 0.0,
    val proteinPer100g: Double = 0.0,
    val carbsPer100g: Double = 0.0,
    val fatPer100g: Double = 0.0,
    val grams: Double = 0.0,
)

@Serializable
data class DishDraftStep(val title: String = "", val text: String = "", val image: String? = null) {
    fun isEmpty() = title.isBlank() && text.isBlank() && image == null
}

data class DishDraftDetails(
    val name: String = "",
    val description: String = "",
    val durationMinutes: Int? = null,
    val images: List<String> = emptyList(),
    val steps: List<DishDraftStep> = emptyList(),
    val showImages: Boolean = false,
    val showSteps: Boolean = false,
)

object DishDraft {
    const val PRIVATE_INGREDIENT_PREFIX = "private:"

    private val ingredients = mutableListOf<DishDraftIngredient>()
    private var details = DishDraftDetails()

    fun read(): List<DishDraftIngredient> = ingredients.toList()

    fun append(ingredient: DishDraftIngredient) {
        ingredients += ingredient
    }

    fun remove(index: Int) {
        if (index in ingredients.indices) ingredients.removeAt(index)
    }

    fun readDetails(): DishDraftDetails = details

    fun writeDetails(next: DishDraftDetails) {
        details = next
    }

    fun clear() {
        ingredients.clear()
        details = DishDraftDetails()
    }

    fun isPrivateIngredientId(productId: String) = productId.startsWith(PRIVATE_INGREDIENT_PREFIX)
}

// ---------------------------------------------------------------------------
// src/lib/meal-share.ts — which other profiles a new registration is shared with.

data class MealShareTarget(val profileId: String, val factor: Double)

object MealShare {
    val PORTION_FACTORS = listOf(0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0)

    val targets = mutableStateListOf<MealShareTarget>()

    fun update(next: List<MealShareTarget>) {
        targets.clear()
        targets.addAll(next)
    }

    /** The `shareWith` part of the POST /api/registrations body. */
    fun body(): Map<String, Any> =
        if (targets.isEmpty()) emptyMap()
        else mapOf("shareWith" to targets.map { mapOf("profileId" to it.profileId, "factor" to it.factor) })
}

// ---------------------------------------------------------------------------
// Device preferences (web localStorage keys).

object FoodPrefs {
    const val WHEEL_ACTIONS_KEY = "hellocal.frontpage.wheelActions"
    const val FAB_SIDE_KEY = "hellocal.frontpage.fabSide"
    const val FAB_OFFSET_Y_KEY = "hellocal.frontpage.fabOffsetY"
    const val STAT_KEYS_KEY = "hellocal.frontpage.statKeys"
    const val ADD_MENU_LAYOUT_KEY = "hellocal.addMenu.layout"
    const val ONBOARDING_DISMISSED_KEY = "hellocal:onboarding-spotlight-dismissed:v1"
    const val FOODS_SNAPSHOT_KEY = "hf:foods:snapshot"
    const val PENDING_PRODUCTS_KEY = "hellocal.offlineProducts"

    fun get(key: String): String? = runCatching { NativeHooks.secureStorage.get(key) }.getOrNull()

    fun set(key: String, value: String?) {
        runCatching { NativeHooks.secureStorage.set(key, value) }
    }

    private val stringList = ListSerializer(String.serializer())

    fun getList(key: String): List<String>? = get(key)?.let { raw -> runCatching { ApiJson.decodeFromString(stringList, raw) }.getOrNull() }

    fun setList(key: String, value: List<String>) = set(key, ApiJson.encodeToString(stringList, value))

    /** Settings → Visning → Forside: "left" | "right" (default left). */
    var fabSide by mutableStateOf(get(FAB_SIDE_KEY)?.takeIf { it == "left" || it == "right" } ?: "left")
        private set

    fun saveFabSide(side: String) {
        fabSide = side
        set(FAB_SIDE_KEY, side)
    }

    val DEFAULT_WHEEL_ACTION_KEYS = listOf("ownDishes", "search", "weight", "water", "camera")
    const val MAX_WHEEL_ACTIONS = 5

    var wheelActionKeys by mutableStateOf(
        getList(WHEEL_ACTIONS_KEY)?.filter { key -> AddActions.all.any { it.key == key } }?.take(MAX_WHEEL_ACTIONS)?.takeIf { it.isNotEmpty() }
            ?: DEFAULT_WHEEL_ACTION_KEYS,
    )
        private set

    fun saveWheelActionKeys(keys: List<String>) {
        wheelActionKeys = keys.take(MAX_WHEEL_ACTIONS)
        setList(WHEEL_ACTIONS_KEY, wheelActionKeys)
    }

    val DEFAULT_STAT_KEYS = listOf("calories", "kcalRemaining", "burned", "steps", "distanceKm")

    var statKeys by mutableStateOf(
        getList(STAT_KEYS_KEY)?.filter { key -> FRONTPAGE_STAT_DEFS.any { it.key == key } }?.takeIf { it.isNotEmpty() } ?: DEFAULT_STAT_KEYS,
    )
        private set

    fun saveStatKeys(keys: List<String>) {
        statKeys = keys
        setList(STAT_KEYS_KEY, keys)
    }

    fun loadFabOffsetY(): Float = get(FAB_OFFSET_Y_KEY)?.toFloatOrNull() ?: 0f

    fun saveFabOffsetY(value: Float) = set(FAB_OFFSET_Y_KEY, value.toInt().toString())
}

// ---------------------------------------------------------------------------
// /api/family — family status (src/components/family/FamilyStatusProvider.tsx).

@Serializable
data class FamilyProfile(val id: String = "", val displayName: String = "", val isChild: Boolean = false, val canWrite: Boolean = false)

@Serializable
data class FamilyMe(val id: String = "", val displayName: String = "")

@Serializable
data class FamilyPresence(val id: String = "", val displayName: String = "")

@Serializable
data class FamilyStatus(
    val me: FamilyMe = FamilyMe(),
    val activeProfile: FamilyProfile = FamilyProfile(),
    val profiles: List<FamilyProfile> = emptyList(),
    val presence: List<FamilyPresence> = emptyList(),
)

object FoodFamily {
    var status by mutableStateOf<FamilyStatus?>(null)
        private set

    suspend fun refresh() {
        try {
            status = ApiJson.decodeFromJsonElement(FamilyStatus.serializer(), Api.get("/api/family"))
        } catch (e: ApiException) {
            if (e.status == 401) status = null
        } catch (_: Exception) {
            // Offline — keep the last known status.
        }
    }
}

// ---------------------------------------------------------------------------
// /api/profile (src/lib/add-actions.ts useAddActionsProfile and the product page).

object FoodProfile {
    var user by mutableStateOf<FoodProfileUser?>(null)
        private set

    suspend fun refresh(): FoodProfileUser? {
        val next = runCatching { ApiJson.decodeFromJsonElement(FoodProfileResponse.serializer(), Api.get("/api/profile")).user }.getOrNull()
        if (next != null) user = next
        return next
    }
}

// ---------------------------------------------------------------------------
// /api/subscription (src/lib/use-subscription-tier.ts).

object FoodSubscription {
    var tier by mutableStateOf<String?>(null)
        private set

    suspend fun load(): String {
        tier?.let { return it }
        val value = runCatching { Api.get("/api/subscription").str("tier") }.getOrNull() ?: "FREE"
        tier = value
        return value
    }

    val isSerious: Boolean? get() = tier?.let { it == "SERIOUS" }
}

// ---------------------------------------------------------------------------
// src/lib/offline-product-queue.ts — products created without a connection are
// queued on the device and replayed later.

object OfflineProductQueue {
    private val listSerializer = ListSerializer(JsonElement.serializer())

    private fun load(): List<JsonElement> =
        FoodPrefs.get(FoodPrefs.PENDING_PRODUCTS_KEY)?.let { runCatching { ApiJson.decodeFromString(listSerializer, it) }.getOrNull() } ?: emptyList()

    private fun save(items: List<JsonElement>) = FoodPrefs.set(FoodPrefs.PENDING_PRODUCTS_KEY, ApiJson.encodeToString(listSerializer, items))

    fun queue(body: JsonObject) = save(load() + body)

    private var flushing = false

    /** POSTs every queued product; stops at the first network failure. */
    suspend fun flush() {
        if (flushing) return
        flushing = true
        try {
            var items = load()
            while (items.isNotEmpty()) {
                try {
                    Api.post("/api/products", items.first())
                } catch (e: ApiException) {
                    // Reached the server but failed (e.g. barcode taken): drop it, retrying would not help.
                } catch (e: Exception) {
                    return
                }
                items = items.drop(1)
                save(items)
            }
        } finally {
            flushing = false
        }
    }
}

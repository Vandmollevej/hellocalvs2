package dk.packroff.hellocal.api

import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.ui.FoodProductResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer

/**
 * Native counterpart of src/lib/offline-cache.ts: last good favourites, recently
 * added and search results, used only when a fetch fails. Cleared on logout.
 */
object OfflineCache {
    private const val FAVORITES = "offcache:favorites"
    private const val RECENT = "offcache:recent"
    private const val SEARCHES = "offcache:searches"
    private const val MAX_SEARCHES = 20

    @Serializable
    private data class Item(
        val id: String,
        val title: String,
        val image: String? = null,
        val brand: String? = null,
        val kcal: Double? = null,
        val macrosEstimated: Boolean = false,
    )

    @Serializable
    private data class SearchEntry(val at: Long = 0, val items: List<Item> = emptyList())

    private val itemsSerializer = ListSerializer(Item.serializer())
    private val searchesSerializer = MapSerializer(String.serializer(), SearchEntry.serializer())
    private var clock = 0L

    private fun FoodProductResult.toItem() = Item(id, title, image, brand, kcal, macrosEstimated)
    private fun Item.toResult() = FoodProductResult(id, title, image, brand, kcal, macrosEstimated)

    private fun readItems(key: String): List<FoodProductResult> = runCatching {
        NativeHooks.secureStorage.get(key)?.let { ApiJson.decodeFromString(itemsSerializer, it) }?.map { it.toResult() }
    }.getOrNull() ?: emptyList()

    private fun writeItems(key: String, list: List<FoodProductResult>) {
        runCatching { NativeHooks.secureStorage.set(key, ApiJson.encodeToString(itemsSerializer, list.map { it.toItem() })) }
    }

    fun favorites(): List<FoodProductResult> = readItems(FAVORITES)
    fun saveFavorites(list: List<FoodProductResult>) = writeItems(FAVORITES, list)
    fun recent(): List<FoodProductResult> = readItems(RECENT)
    fun saveRecent(list: List<FoodProductResult>) = writeItems(RECENT, list)

    private fun readSearches(): Map<String, SearchEntry> = runCatching {
        NativeHooks.secureStorage.get(SEARCHES)?.let { ApiJson.decodeFromString(searchesSerializer, it) }
    }.getOrNull() ?: emptyMap()

    fun saveSearch(query: String, results: List<FoodProductResult>) {
        val key = query.trim().lowercase()
        if (key.isEmpty()) return
        val all = readSearches().toMutableMap()
        all[key] = SearchEntry(++clock, results.map { it.toItem() })
        // Newest last-written wins: keep the entries written most recently.
        val keep = all.entries.toList().takeLast(MAX_SEARCHES).associate { it.key to it.value }
        runCatching { NativeHooks.secureStorage.set(SEARCHES, ApiJson.encodeToString(searchesSerializer, keep)) }
    }

    /** Exact match first; else products from saved searches whose title contains the query. */
    fun findSearch(query: String): List<FoodProductResult>? {
        val key = query.trim().lowercase()
        if (key.isEmpty()) return null
        val all = readSearches()
        all[key]?.let { return it.items.map { i -> i.toResult() } }
        val hits = LinkedHashMap<String, FoodProductResult>()
        for (entry in all.values.reversed()) {
            for (item in entry.items) if (item.title.lowercase().contains(key)) if (item.id !in hits) hits[item.id] = item.toResult()
        }
        return hits.values.toList().takeIf { it.isNotEmpty() }
    }

    fun clear() {
        for (key in listOf(FAVORITES, RECENT, SEARCHES)) runCatching { NativeHooks.secureStorage.set(key, null) }
    }
}

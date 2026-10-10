package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.random.Random

// The user's own arrangement of the statistics page. The web keeps it in
// localStorage (src/lib/stat-layout.ts, stat-charts.ts, stat-sections.ts);
// the app keeps it per device in NativeHooks.secureStorage under the same
// keys and in the same JSON format.

private val storageJson = Json { ignoreUnknownKeys = true }

private fun readJson(key: String): JsonElement? =
    runCatching { NativeHooks.secureStorage.get(key)?.let { storageJson.parseToJsonElement(it) } }.getOrNull()

private fun writeJson(key: String, value: JsonElement) {
    runCatching { NativeHooks.secureStorage.set(key, value.toString()) }
}

/** A list of strings saved under [key] (chart series choices etc.), or null when nothing is saved. */
internal fun loadStringList(key: String): List<String>? =
    (readJson(key) as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }

internal fun saveStringList(key: String, values: List<String>) =
    writeJson(key, buildJsonArray { values.forEach { add(JsonPrimitive(it)) } })

// ---------- Card grid layout (src/lib/stat-layout.ts) ----------

internal const val STAT_LAYOUT_STORAGE_KEY = "hellocal.statistik.layout"

internal sealed interface LayoutItem {
    /** layoutItemId: "stat:<key>" or "<type>:<id>". */
    val itemId: String
}

internal data class StatLayoutItem(val key: String) : LayoutItem {
    override val itemId: String get() = "stat:$key"
}

internal data class HeaderLayoutItem(val id: String, val text: String) : LayoutItem {
    override val itemId: String get() = "header:$id"
}

internal data class DividerLayoutItem(val id: String) : LayoutItem {
    override val itemId: String get() = "divider:$id"
}

/** An explicitly empty half-width slot — part of the saved layout, never compacted away. */
internal data class EmptyLayoutItem(val id: String) : LayoutItem {
    override val itemId: String get() = "empty:$id"
}

/** Opens a fold-out section; everything up to the matching end (same id) is inside it. */
internal data class AccordionLayoutItem(val id: String, val title: String, val open: Boolean) : LayoutItem {
    override val itemId: String get() = "accordion:$id"
}

internal data class AccordionEndLayoutItem(val id: String) : LayoutItem {
    override val itemId: String get() = "accordionEnd:$id"
}

internal fun makeLayoutId(): String =
    "id-${nowMillis()}-${Random.nextLong().toULong().toString(36)}"

internal fun makeEmptyStatSlot(): EmptyLayoutItem = EmptyLayoutItem(makeLayoutId())

/** Half-width items occupy one of the two column slots; the rest span a full row. */
internal fun LayoutItem.isHalfWidth(): Boolean = this is StatLayoutItem || this is EmptyLayoutItem

private fun trailingRunLength(layout: List<LayoutItem>): Int {
    var count = 0
    var i = layout.lastIndex
    while (i >= 0 && layout[i].isHalfWidth()) {
        count += 1
        i -= 1
    }
    return count
}

internal data class IndexRange(val start: Int, val end: Int)

/** [start, end] of an accordion's own markers, or null. */
internal fun accordionRange(layout: List<LayoutItem>, id: String): IndexRange? {
    val start = layout.indexOfFirst { it is AccordionLayoutItem && it.id == id }
    if (start < 0) return null
    var end = -1
    for (i in start + 1 until layout.size) {
        val item = layout[i]
        if (item is AccordionEndLayoutItem && item.id == id) {
            end = i
            break
        }
    }
    return if (end < 0) null else IndexRange(start, end)
}

/** Id of the accordion the item at [index] sits inside, or null at top level. */
internal fun accordionAt(layout: List<LayoutItem>, index: Int): String? {
    var inside: String? = null
    var i = 0
    while (i < index && i < layout.size) {
        when (val item = layout[i]) {
            is AccordionLayoutItem -> inside = item.id
            is AccordionEndLayoutItem -> inside = null
            else -> Unit
        }
        i += 1
    }
    return inside
}

private fun repairAccordions(layout: List<LayoutItem>): List<LayoutItem> {
    val next = mutableListOf<LayoutItem>()
    var openId: String? = null
    val seen = mutableSetOf<String>()
    fun close() {
        val id = openId ?: return
        while (next.size >= 2 && next[next.size - 1] is EmptyLayoutItem && next[next.size - 2] is EmptyLayoutItem) {
            next.removeAt(next.lastIndex)
            next.removeAt(next.lastIndex)
        }
        next += AccordionEndLayoutItem(id)
        openId = null
    }
    for (item in layout) {
        when (item) {
            is AccordionLayoutItem -> {
                if (!seen.add(item.id)) continue
                close()
                next += item
                openId = item.id
            }
            is AccordionEndLayoutItem -> if (item.id == openId) close()
            else -> next += item
        }
    }
    close()
    return next
}

/**
 * Every run of half-width slots gets an even length (a left and a right slot
 * per row) and completely empty rows at the very end are dropped.
 */
internal fun normalizeStatLayout(layout: List<LayoutItem>): List<LayoutItem> {
    val usedIds = layout.map { if (it is StatLayoutItem) it.key else it.itemId.substringAfter(':') }.toMutableSet()
    val next = mutableListOf<LayoutItem>()
    fun filler(): EmptyLayoutItem {
        var n = next.size
        while (usedIds.contains("pad-$n")) n += 1
        usedIds += "pad-$n"
        return EmptyLayoutItem("pad-$n")
    }
    var runLength = 0
    for (item in repairAccordions(layout)) {
        if (item.isHalfWidth()) {
            next += item
            runLength += 1
            continue
        }
        if (runLength % 2 != 0) next += filler()
        runLength = 0
        next += item
    }
    if (runLength % 2 != 0) next += filler()
    while (trailingRunLength(next) >= 2 && next[next.size - 1] is EmptyLayoutItem && next[next.size - 2] is EmptyLayoutItem) {
        next.removeAt(next.lastIndex)
        next.removeAt(next.lastIndex)
    }
    return next
}

/**
 * Drops every completely empty row (two empty slots side by side), wherever it
 * sits — when editing ends and a saved layout is loaded, so deleted cards never
 * leave blank space. A row with one card and one empty slot stays.
 */
internal fun dropEmptyRows(layout: List<LayoutItem>): List<LayoutItem> {
    val next = mutableListOf<LayoutItem>()
    val run = mutableListOf<LayoutItem>()
    fun flush() {
        for (pair in run.chunked(2)) {
            if (pair.size == 2 && pair.all { it is EmptyLayoutItem }) continue
            next += pair
        }
        run.clear()
    }
    for (item in normalizeStatLayout(layout)) {
        if (item.isHalfWidth()) run += item else { flush(); next += item }
    }
    flush()
    return next
}

private fun layoutItemToJson(item: LayoutItem): JsonObject = buildJsonObject {
    when (item) {
        is StatLayoutItem -> { put("type", "stat"); put("key", item.key) }
        is HeaderLayoutItem -> { put("type", "header"); put("id", item.id); put("text", item.text) }
        is DividerLayoutItem -> { put("type", "divider"); put("id", item.id) }
        is EmptyLayoutItem -> { put("type", "empty"); put("id", item.id) }
        is AccordionLayoutItem -> { put("type", "accordion"); put("id", item.id); put("title", item.title); put("open", item.open) }
        is AccordionEndLayoutItem -> { put("type", "accordionEnd"); put("id", item.id) }
    }
}

private fun layoutItemFromJson(obj: JsonObject): LayoutItem? {
    val id = obj.string("id")
    return when (obj.string("type")) {
        "stat" -> obj.string("key")?.let { StatLayoutItem(it) }
        "header" -> id?.let { HeaderLayoutItem(it, obj.string("text") ?: "") }
        "divider" -> id?.let { DividerLayoutItem(it) }
        "empty" -> id?.let { EmptyLayoutItem(it) }
        "accordion" -> id?.let { AccordionLayoutItem(it, obj.string("title") ?: "", obj.flag("open") ?: true) }
        "accordionEnd" -> id?.let { AccordionEndLayoutItem(it) }
        else -> null
    }
}

internal fun defaultStatLayout(): List<LayoutItem> = DEFAULT_ACTIVE_STAT_KEYS.map { StatLayoutItem(it) }

internal fun loadStatLayout(defaultLayout: List<LayoutItem> = defaultStatLayout()): List<LayoutItem> {
    val saved = readJson(STAT_LAYOUT_STORAGE_KEY) as? JsonArray ?: return normalizeStatLayout(defaultLayout)
    return dropEmptyRows(saved.mapNotNull { (it as? JsonObject)?.let(::layoutItemFromJson) })
}

internal fun saveStatLayout(layout: List<LayoutItem>) =
    writeJson(STAT_LAYOUT_STORAGE_KEY, JsonArray(normalizeStatLayout(layout).map(::layoutItemToJson)))

/** Adds a card at the bottom — into the free right slot of the last row when there is one. */
internal fun addStatCardToLayout(key: String) {
    val current = loadStatLayout()
    if (current.any { it is StatLayoutItem && it.key == key }) return
    val card = StatLayoutItem(key)
    val next = if (current.lastOrNull() is EmptyLayoutItem) current.dropLast(1) + card else current + card
    saveStatLayout(next)
}

/** Which card keys are active in the saved (or default) layout. */
internal fun activeStatKeys(): Set<String> = loadStatLayout().filterIsInstance<StatLayoutItem>().map { it.key }.toSet()

/** A new "Overskrift" header at the top. */
internal fun addHeaderToLayout() = saveStatLayout(listOf(HeaderLayoutItem(makeLayoutId(), "Overskrift")) + loadStatLayout())

/** A new, open, empty fold-out section at the top. */
internal fun addAccordionToLayout(title: String) {
    val id = makeLayoutId()
    saveStatLayout(listOf(AccordionLayoutItem(id, title, true), AccordionEndLayoutItem(id)) + loadStatLayout())
}

/** A new divider at the top. */
internal fun addDividerToLayout() = saveStatLayout(listOf(DividerLayoutItem(makeLayoutId())) + loadStatLayout())

// ---------- Section order (src/lib/stat-sections.ts) ----------

internal enum class StatSectionKey(val key: String) { Charts("charts"), Cards("cards") }

private const val STAT_SECTION_ORDER_STORAGE_KEY = "hellocal.statistik.sections"
private val DEFAULT_STAT_SECTION_ORDER = listOf(StatSectionKey.Charts, StatSectionKey.Cards)

private fun sanitizeSections(keys: List<String>?): List<StatSectionKey> {
    if (keys == null) return DEFAULT_STAT_SECTION_ORDER
    val valid = keys.distinct().mapNotNull { k -> StatSectionKey.entries.firstOrNull { it.key == k } }
    return valid + DEFAULT_STAT_SECTION_ORDER.filter { it !in valid }
}

internal fun loadSectionOrder(): List<StatSectionKey> = sanitizeSections(loadStringList(STAT_SECTION_ORDER_STORAGE_KEY))

internal fun saveSectionOrder(order: List<StatSectionKey>) =
    saveStringList(STAT_SECTION_ORDER_STORAGE_KEY, sanitizeSections(order.map { it.key }).map { it.key })

/** Moves a section one step up (-1) or down (+1). */
internal fun moveSection(order: List<StatSectionKey>, key: StatSectionKey, delta: Int): List<StatSectionKey> {
    val index = order.indexOf(key)
    val target = index + delta
    if (index < 0 || target < 0 || target >= order.size) return order
    val next = order.toMutableList()
    next[index] = order[target]
    next[target] = order[index]
    return next
}

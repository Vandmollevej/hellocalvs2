package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FieldSlider
import dk.packroff.hellocal.ui.HcAccordionCard
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcChevronRow
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcSearchField
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.serialization.Serializable

// Native port of src/components/activity/TrainingSession.tsx (Træningspas):
// the rows at the top of Add activity, the exercise popup with pictures and
// Danish + English search, and one card per exercise with the picture as on a
// product page and one bar per set (reps on plus/minus, weight on a slider).
// The catalog comes from GET /api/training-exercises (src/lib/training-exercises.ts).

internal val TRAINING_CATEGORIES = listOf("machines", "free_weights", "crossfit")

/** src/lib/training-exercises.ts TRAINING_SPORT */
internal val TRAINING_SPORT = mapOf("machines" to "strength", "free_weights" to "strength", "crossfit" to "crossfit")

private val CATEGORY_ICONS = mapOf("machines" to "Weight", "free_weights" to "Barbell", "crossfit" to "Gymnastics")

/** Max weight on the slider per category (kg). */
private val MAX_WEIGHT = mapOf("machines" to 200.0, "free_weights" to 250.0, "crossfit" to 150.0)

private const val MAX_REPS = 100

@Serializable
internal data class TrainingExercise(val key: String, val category: String, val da: String, val en: String, val image: String)

@Serializable
private data class TrainingCatalogResponse(val exercises: List<TrainingExercise> = emptyList())

internal data class TrainingSet(val weightKg: Double, val reps: Int)

internal data class TrainingEntry(val key: String, val sets: List<TrainingSet>)

internal fun newTrainingEntry(key: String, category: String) =
    TrainingEntry(key, listOf(TrainingSet(if (category == "crossfit") 0.0 else 20.0, 10)))

internal fun TrainingEntry.toBody(): Map<String, Any?> =
    mapOf("key" to key, "sets" to sets.map { mapOf("weightKg" to it.weightKg, "reps" to it.reps) })

/** Name in the app language: Danish for "da", else English. */
private fun TrainingExercise.name(locale: Locale) = if (locale == Locale.Da) da else en

private fun fold(value: String) = value.lowercase()
    .replace('é', 'e').replace('è', 'e').replace('á', 'a').replace('ü', 'u')
    .replace(Regex("[-_'’]"), " ").replace(Regex("\\s+"), " ").trim()

/** src/lib/training-exercises.ts searchTrainingExercises — every word in Danish or English. */
private fun search(list: List<TrainingExercise>, category: String, query: String): List<TrainingExercise> {
    val inCategory = list.filter { it.category == category }
    val needle = fold(query)
    if (needle.isEmpty()) return inCategory
    val words = needle.split(" ")
    val hits = inCategory.filter { e -> val hay = "${fold(e.da)} ${fold(e.en)}"; words.all { hay.contains(it) } }
    return hits.sortedBy { if (fold(it.da).startsWith(needle) || fold(it.en).startsWith(needle)) 0 else 1 }
}

/** Catalog, fetched once per app run. */
private var cachedCatalog: List<TrainingExercise>? = null

@Composable
internal fun rememberTrainingCatalog(): List<TrainingExercise> {
    var catalog by remember { mutableStateOf(cachedCatalog ?: emptyList()) }
    LaunchedEffect(Unit) {
        if (cachedCatalog != null) return@LaunchedEffect
        runCatching { ApiJson.decodeFromJsonElement(TrainingCatalogResponse.serializer(), Api.get("/api/training-exercises")).exercises }
            .getOrNull()?.takeIf { it.isNotEmpty() }?.let {
                cachedCatalog = it
                catalog = it
            }
    }
    return catalog
}

@Composable
internal fun TrainingCategoryRows(onPick: (String) -> Unit) {
    val t = LocalTranslator.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcSectionTitle(t.t("activity.training.title"))
        HcAccordionCard {
            TRAINING_CATEGORIES.forEachIndexed { index, category ->
                HcChevronRow(
                    label = t.t("activity.training.category.$category"),
                    onClick = { onPick(category) },
                    icon = CATEGORY_ICONS[category],
                    divider = index < TRAINING_CATEGORIES.lastIndex,
                )
            }
        }
    }
}

@Composable
internal fun TrainingExerciseSheet(category: String, catalog: List<TrainingExercise>, onPick: (String) -> Unit, onDismiss: () -> Unit) {
    val t = LocalTranslator.current
    HcBottomSheet(onDismiss = onDismiss, title = t.t("activity.training.category.$category"), size = HcSheetSize.Full) {
        val close = LocalHcSheetClose.current
        var query by remember { mutableStateOf("") }
        val matches = search(catalog, category, query)
        Box(Modifier.padding(bottom = 16.dp)) {
            HcSearchField(query, { query = it }, t.t("activity.training.search"))
        }
        if (matches.isEmpty()) {
            HcText(t.t("activity.training.noResults"), HcTypeRoles.Body, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        } else {
            LazyColumn(Modifier.weight(1f, fill = false).fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan)) {
                itemsIndexed(matches, key = { _, e -> e.key }) { index, exercise ->
                    val name = exercise.name(t.locale)
                    val other = if (t.locale == Locale.Da) exercise.en else exercise.da
                    Column {
                        Row(
                            Modifier.fillMaxWidth().clickable {
                                onPick(exercise.key)
                                close()
                            }.padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            HcRemoteImage(
                                exercise.image,
                                Modifier.size(56.dp).clip(CircleShape).background(HcColors.Card),
                                contentScale = ContentScale.Crop,
                            )
                            Column(Modifier.weight(1f)) {
                                HcText(name, HcTypeRoles.Body, maxLines = 1)
                                if (other != name) HcText(other, HcTypeRoles.Caption, maxLines = 1)
                            }
                        }
                        if (index < matches.lastIndex) HcLine()
                    }
                }
            }
        }
    }
}

private fun formatKg(value: Double): String {
    val rounded = kotlin.math.round(value * 10) / 10
    return if (rounded % 1.0 == 0.0) rounded.toLong().toString() else rounded.toString().replace('.', ',')
}

@Composable
internal fun TrainingExerciseCard(
    entry: TrainingEntry,
    category: String,
    catalog: List<TrainingExercise>,
    onChange: (TrainingEntry) -> Unit,
    onRemove: () -> Unit,
) {
    val t = LocalTranslator.current
    val exercise = catalog.firstOrNull { it.key == entry.key } ?: return
    val maxWeight = MAX_WEIGHT[category] ?: 200.0

    fun updateSet(index: Int, set: TrainingSet) = onChange(entry.copy(sets = entry.sets.mapIndexed { i, s -> if (i == index) set else s }))

    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Product-page circle (ProductImageCircle, 190 px) with the black remove circle top-right.
        Box(Modifier.size(190.dp)) {
            Box(Modifier.size(190.dp).clip(CircleShape).background(HcColors.Tan)) {
                HcRemoteImage(exercise.image, Modifier.size(190.dp), contentScale = ContentScale.Crop)
            }
            Box(
                Modifier.align(Alignment.TopEnd).offset(x = 6.dp, y = (-6).dp).size(20.dp).clip(CircleShape).background(HcColors.Black).clickable(onClick = onRemove),
                contentAlignment = Alignment.Center,
            ) { HcIcon("X", size = 13.dp, color = HcColors.Tan) }
        }
        HcText(exercise.name(t.locale), HcTypeRoles.CardTitle, align = TextAlign.Center)
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            entry.sets.forEachIndexed { index, set ->
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan).padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        HcText(t.t("activity.training.set", "n" to index + 1), HcTypeRoles.Body, Modifier.weight(1f), bold = true, maxLines = 1)
                        Box(
                            Modifier.size(36.dp).clip(CircleShape).clickable(enabled = set.reps > 1) { updateSet(index, set.copy(reps = maxOf(1, set.reps - 1))) },
                            contentAlignment = Alignment.Center,
                        ) { HcIcon("Minus", size = 18.dp, color = HcColors.Black) }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            HcText(set.reps.toString(), HcTypeRoles.Body, bold = true)
                            HcText(" ${t.t("activity.training.reps")}", HcTypeRoles.Body, maxLines = 1)
                        }
                        Box(
                            Modifier.size(36.dp).clip(CircleShape).clickable(enabled = set.reps < MAX_REPS) { updateSet(index, set.copy(reps = minOf(MAX_REPS, set.reps + 1))) },
                            contentAlignment = Alignment.Center,
                        ) { HcIcon("Plus", size = 18.dp, color = HcColors.Black) }
                        if (entry.sets.size > 1) {
                            Box(
                                Modifier.size(28.dp, 36.dp).clickable { onChange(entry.copy(sets = entry.sets.filterIndexed { i, _ -> i != index })) },
                                contentAlignment = Alignment.CenterEnd,
                            ) { HcIcon("X", size = 16.dp, color = HcColors.Black) }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.weight(1f)) {
                            FieldSlider(
                                formatKg(set.weightKg).replace(',', '.'),
                                0.0,
                                maxWeight,
                                { updateSet(index, set.copy(weightKg = it.toDoubleOrNull() ?: 0.0)) },
                                step = 0.5,
                            )
                        }
                        HcText(
                            if (set.weightKg > 0) "${formatKg(set.weightKg)} kg" else t.t("activity.training.bodyweight"),
                            HcTypeRoles.Body,
                            Modifier.width(80.dp),
                            bold = true,
                            align = TextAlign.End,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().clickable { onChange(entry.copy(sets = entry.sets + (entry.sets.lastOrNull() ?: TrainingSet(0.0, 10)))) },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            HcIcon("Plus", size = 16.dp, color = HcColors.Black)
            HcText(t.t("activity.training.addSet"), HcTypeRoles.Body, bold = true, underline = true, color = HcColors.Black)
        }
    }
}

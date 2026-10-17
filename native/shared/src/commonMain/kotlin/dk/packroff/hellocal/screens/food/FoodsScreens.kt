package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.border
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.FoodDivider
import dk.packroff.hellocal.ui.FoodFavoriteIcon
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodListCard
import dk.packroff.hellocal.ui.FoodRow
import dk.packroff.hellocal.ui.FoodSkeleton
import dk.packroff.hellocal.ui.FoodSkeletonCards
import dk.packroff.hellocal.ui.FoodSkeletonMediaRows
import dk.packroff.hellocal.ui.FoodSlider
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.FoodPillField
import dk.packroff.hellocal.ui.icons.HcIcon
import dk.packroff.hellocal.screens.capture.CaptureHooks
import dk.packroff.hellocal.screens.capture.CapturePermissionDenied
import dk.packroff.hellocal.screens.capture.MealLanguagePicker
import dk.packroff.hellocal.screens.capture.MealInputLanguages
import dk.packroff.hellocal.screens.capture.LiveWaveform
import dk.packroff.hellocal.screens.capture.PingRing
import dk.packroff.hellocal.screens.capture.rememberMealInputLanguage
import dk.packroff.hellocal.screens.capture.standMicrophone
import dk.packroff.hellocal.screens.capture.InterpretedResponse
import dk.packroff.hellocal.screens.capture.VoiceItem
import dk.packroff.hellocal.screens.capture.VoiceItemRow
import dk.packroff.hellocal.screens.capture.registrationBody
import dk.packroff.hellocal.screens.capture.loadPersistedVoiceItems
import dk.packroff.hellocal.screens.capture.persistVoiceItems
import dk.packroff.hellocal.ui.CaptureDetailRow
import dk.packroff.hellocal.ui.CaptureEntryDetailsSheet
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.FoodListSection
import kotlin.math.roundToInt
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.coroutines.Job
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.ColorFilter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

// ---------------------------------------------------------------------------
// /foods — Madvarer (src/app/foods/page.tsx + src/lib/foods-snapshot.ts).

@Serializable
private data class FoodsSnapshot(val profileId: String = "", val products: List<ProductListItem> = emptyList(), val favoriteIds: List<String> = emptyList())

private object FoodsSnapshotStore {
    fun read(profileId: String): FoodsSnapshot? = FoodPrefs.get(FoodPrefs.FOODS_SNAPSHOT_KEY)
        ?.let { runCatching { ApiJson.decodeFromString(FoodsSnapshot.serializer(), it) }.getOrNull() }
        ?.takeIf { it.profileId == profileId }

    fun write(snapshot: FoodsSnapshot) = FoodPrefs.set(FoodPrefs.FOODS_SNAPSHOT_KEY, ApiJson.encodeToString(FoodsSnapshot.serializer(), snapshot))
}

private const val SEARCH_MIN_LENGTH = 2
private const val SEARCH_DEBOUNCE_MS = 140L
private const val SEARCH_CACHE_TTL_MS = 5 * 60 * 1000L
private const val SKELETON_DELAY_MS = 300L

/** Short-lived search cache (module level like the web's Map). */
private object FoodsSearchCache {
    val entries = mutableMapOf<String, Pair<Long, List<ProductListItem>>>()
}

/** Native port of src/app/foods/page.tsx. */
@OptIn(ExperimentalUuidApi::class)
@Composable
fun FoodsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val prefill = listOfNotNull(args.opt("time")?.let { "time=${encodeUri(it)}" }, args.opt("date")?.let { "date=${encodeUri(it)}" })
        .joinToString("&").let { if (it.isEmpty()) "" else "?$it" }
    var query by remember { mutableStateOf("") }
    // Mikrofonen (tidligere Tale-siden): det sagte skrives løbende i søgefeltet, så listen søges og raffineres, mens man taler.
    val lang = rememberMealInputLanguage()
    var micListening by remember { mutableStateOf(false) }
    var micUnsupported by remember { mutableStateOf(false) }
    var micError by remember { mutableStateOf<String?>(null) }
    var micSession by remember { mutableStateOf<Job?>(null) }
    // Søgninger fra mikrofonen logges under én session i Analyse → Søgning → Tale, så længe søgefeltet står med det sagte.
    var voiceSessionId by remember { mutableStateOf<String?>(null) }
    var voiceText by remember { mutableStateOf<String?>(null) }
    // Tale-sidens funktion, uændret (DECISIONS 2026-10-16): det sagte tolkes af AI'en til forslag med
    // mængde, løbende mens man taler og en sidste gang, når mikrofonen stopper. Forslag fra tidligere
    // optagelser bliver stående; intet gemmes uden Tilføj; dagens tilføjede varer huskes.
    var micSpoken by remember { mutableStateOf(false) }
    var micFinished by remember { mutableStateOf(0) }
    var voiceItems by remember { mutableStateOf(loadPersistedVoiceItems()) }
    var voiceBatch by remember { mutableStateOf(0) }
    var interpreting by remember { mutableStateOf(false) }
    var voiceError by remember { mutableStateOf<String?>(null) }
    var adding by remember { mutableStateOf(false) }
    var interpretSeq by remember { mutableStateOf(0) }
    var confirmDelete by remember { mutableStateOf<VoiceItem?>(null) }
    fun updateVoiceItems(next: List<VoiceItem>) {
        voiceItems = next
        persistVoiceItems(next)
    }
    fun keepOther(batch: Int) = voiceItems.filter { it.saved || it.batch != batch }
    fun newRecording() {
        voiceBatch++
        interpretSeq++
        interpreting = false
        voiceError = null
    }
    var searchResults by remember { mutableStateOf<List<ProductListItem>>(emptyList()) }
    var loadedSnapshot by remember { mutableStateOf<FoodsSnapshot?>(null) }
    var loadFailed by remember { mutableStateOf(false) }
    var loadError by remember { mutableStateOf<Throwable?>(null) }
    var skeletonDue by remember { mutableStateOf(false) }
    val activeProfileId = FoodFamily.status?.activeProfile?.id
    val cachedSnapshot = remember(activeProfileId) { activeProfileId?.let { FoodsSnapshotStore.read(it) } }
    val snapshot = loadedSnapshot?.takeIf { activeProfileId == null || it.profileId == activeProfileId } ?: cachedSnapshot
    val waiting = snapshot == null && !loadFailed

    LaunchedEffect(Unit) { if (FoodFamily.status == null) FoodFamily.refresh() }
    LaunchedEffect(waiting) {
        if (!waiting) return@LaunchedEffect
        delay(SKELETON_DELAY_MS)
        skeletonDue = true
    }
    LaunchedEffect(Unit) {
        try {
            val data = ApiJson.decodeFromJsonElement(ProductListResponse.serializer(), Api.get("/api/products/most-used"))
            val favoriteIds = runCatching { loadFavoriteProducts().map { it.id } }.getOrNull()
            val profileId = data.profileId ?: ""
            val next = FoodsSnapshot(profileId, data.products, favoriteIds ?: FoodsSnapshotStore.read(profileId)?.favoriteIds ?: emptyList())
            loadedSnapshot = next
            FoodsSnapshotStore.write(next)
        } catch (e: Exception) {
            loadError = e
            loadFailed = true
        }
    }

    fun startMic() {
        val record = CaptureHooks.recordSpeech
        if (record == null) {
            micUnsupported = true
            return
        }
        micSession?.cancel()
        CaptureHooks.stopSpeech()
        newRecording()
        micError = null
        micListening = true
        voiceSessionId = Uuid.random().toString()
        voiceText = null
        val tag = MealInputLanguages.speechLangFor(lang.language, lang.region)
        var job: Job? = null
        job = scope.launch {
            try {
                val result = record(tag) { partial ->
                    if (micSession == job) {
                        micSpoken = true
                        query = partial.trim()
                        voiceText = query
                    }
                }
                if (micSession != job) return@launch
                micSession = null
                micListening = false
                (result ?: query).trim().takeIf { it.isNotEmpty() }?.let { query = it; voiceText = it }
                micFinished++
            } catch (e: CapturePermissionDenied) {
                if (micSession != job) return@launch
                micSession = null
                micListening = false
                micError = t.t("voice.error.micDenied")
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                if (micSession != job) return@launch
                micSession = null
                micListening = false
                micError = t.t("voice.error.recognitionInterrupted")
            }
        }
        micSession = job
    }

    fun stopMic() {
        if (micSession == null) return
        CaptureHooks.stopSpeech()
    }
    LaunchedEffect(Unit) { if (args.opt("mic") == "1") startMic() }

    LaunchedEffect(query, micListening, micFinished) {
        if (!micSpoken) return@LaunchedEffect
        val transcript = query.trim()
        val final = !micListening
        val batch = voiceBatch
        if (final && transcript.isEmpty()) {
            val remaining = keepOther(batch)
            updateVoiceItems(remaining)
            if (remaining.isEmpty()) voiceError = t.t("voice.error.noSpeech")
            return@LaunchedEffect
        }
        if (transcript.isEmpty()) return@LaunchedEffect
        if (!final) delay(700)
        val seq = ++interpretSeq
        interpreting = true
        try {
            val data = ApiJson.decodeFromJsonElement(
                InterpretedResponse.serializer(),
                Api.post("/api/ai/interpret-meal", listOfNotNull("transcript" to transcript, "language" to lang.language, voiceSessionId?.let { "voiceSession" to it }).toMap()),
            )
            if (seq != interpretSeq) return@LaunchedEffect
            val interpreted = data.items.mapIndexed { index, item -> VoiceItem("pending-$batch-$seq-$index", item, saved = false, batch = batch) }
            val others = keepOther(batch)
            if (final && interpreted.isEmpty()) {
                updateVoiceItems(others)
                if (others.isEmpty()) voiceError = t.t("voice.error.noFoodRecognized")
            } else {
                updateVoiceItems(others + interpreted)
                if (final) voiceError = null
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (_: Exception) {
            // The live interpretation is preliminary; only the final one reports an error.
            if (seq == interpretSeq && final) {
                updateVoiceItems(keepOther(batch))
                voiceError = t.t("voice.error.aiInterpretFailed")
            }
        } finally {
            if (seq == interpretSeq) interpreting = false
        }
    }

    // Nothing is saved without the user asking (docs/AI.md).
    fun addVoiceItems(pending: List<VoiceItem>) {
        if (pending.isEmpty()) return
        adding = true
        voiceError = null
        scope.launch {
            val newlySaved = pending.mapNotNull { entry ->
                runCatching {
                    val res = Api.post("/api/registrations", registrationBody(entry.item)).jsonObject
                    val id = res["registration"]?.jsonObject?.get("id")?.jsonPrimitive?.content ?: return@runCatching null
                    entry.copy(id = id, saved = true)
                }.getOrNull()
            }
            val pendingIds = pending.map { it.id }.toSet()
            updateVoiceItems(voiceItems.filter { it.id !in pendingIds } + newlySaved)
            adding = false
            if (newlySaved.isNotEmpty()) NativeHooks.onRegistrationChanged()
            if (newlySaved.size < pending.size) voiceError = t.t("voice.error.couldNotSaveRegistrations")
        }
    }

    fun deleteVoiceItem(entry: VoiceItem) {
        if (entry.saved) {
            confirmDelete = entry
            return
        }
        updateVoiceItems(voiceItems.filter { it.id != entry.id })
    }

    fun deleteSavedVoiceItem(entry: VoiceItem) {
        updateVoiceItems(voiceItems.filter { it.id != entry.id })
        scope.launch {
            runCatching { Api.delete("/api/registrations/${entry.id}") }
            NativeHooks.onRegistrationChanged()
        }
    }

    fun favoriteVoiceItem(productId: String) {
        scope.launch { runCatching { Api.post("/api/favorites", mapOf("productId" to productId)) } }
    }

    var correction by remember { mutableStateOf(SearchCorrection()) }
    var exactQuery by remember { mutableStateOf<String?>(null) }
    val q = query.trim()
    val isSearching = q.length >= SEARCH_MIN_LENGTH
    val cacheKey = q.lowercase()
    LaunchedEffect(q, exactQuery) {
        if (q.length < SEARCH_MIN_LENGTH) return@LaunchedEffect
        val exact = exactQuery == q
        // Exact ("search instead") results are never cached under the normal key.
        val hadCacheHit = !exact && FoodsSearchCache.entries.containsKey(cacheKey)
        correction = SearchCorrection()
        delay(SEARCH_DEBOUNCE_MS)
        try {
            val hour = FoodTime.local(FoodTime.now()).hour
            val voice = voiceSessionId?.takeIf { voiceText == q }?.let { "&voice=${encodeUri(it)}" } ?: ""
            val data = ApiJson.decodeFromJsonElement(ProductListResponse.serializer(), Api.get("/api/products?q=${encodeUri(q)}&hour=$hour&take=20${if (exact) "&exact=1" else ""}$voice"))
            val products = data.products
            correction = SearchCorrection.of(data)
            if (!exact) FoodsSearchCache.entries[cacheKey] = (FoodTime.now().toEpochMilliseconds() + SEARCH_CACHE_TTL_MS) to products
            searchResults = products
        } catch (_: Exception) {
            if (!hadCacheHit) searchResults = emptyList()
        }
    }
    val cachedResults = if (isSearching && exactQuery != q) FoodsSearchCache.entries[cacheKey]?.second else null
    val favoriteIds = snapshot?.favoriteIds?.toSet() ?: emptySet()
    // Favorites first (user rule 2026-10-16) — the server sends them first; a new bookmark moves up at once.
    val favorites = (snapshot?.products ?: emptyList()).sortedBy { it.id !in favoriteIds }
    val ready = snapshot != null
    val visible = if (isSearching) cachedResults ?: searchResults else favorites

    fun toggleFavorite(productId: String, next: Boolean) {
        snapshot?.let { s ->
            val ids = s.favoriteIds.toMutableSet()
            if (next) ids += productId else ids -= productId
            val updated = s.copy(favoriteIds = ids.toList())
            loadedSnapshot = updated
            FoodsSnapshotStore.write(updated)
        }
        scope.launch { setFavorite(productId, next) }
    }

    fun trackSearchClick(productId: String) {
        if (query.trim().length < SEARCH_MIN_LENGTH) return
        val hour = FoodTime.local(FoodTime.now()).hour
        scope.launch { runCatching { Api.post("/api/products/search-event", mapOf("productId" to productId, "localHour" to hour)) } }
    }

    HcScreen(
        t.t("foods.title"),
        icon = { HcIcon("Apple", size = 20.dp, stroke = 2f, color = HcColors.White) },
        contentPadding = LIST_PAGE_PADDING,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.size(96.dp).clickable(enabled = !micUnsupported) { if (micListening) stopMic() else startMic() },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (micListening) PingRing()
                        Box(Modifier.size(80.dp).clip(CircleShape).background(if (micUnsupported) HcColors.Gray else HcColors.Green), contentAlignment = Alignment.Center) {
                            Image(standMicrophone, null, Modifier.size(56.dp), colorFilter = ColorFilter.tint(HcColors.White))
                        }
                    }
                    HcText(
                        when {
                            micListening -> t.t("voice.listeningStatus")
                            micUnsupported -> t.t("voice.unsupported")
                            else -> t.t("voice.tapToTalk")
                        },
                        HcTypeRoles.Small,
                        Modifier.padding(top = 8.dp),
                        bold = true,
                        color = HcColors.Green,
                    )
                    if (micListening) LiveWaveform()
                    micError?.let {
                        HcText(it, HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.RedDark, align = TextAlign.Center)
                    }
                }
                // The language flag sits left of the microphone, mirroring the favourite mark on the right.
                Box(Modifier.align(Alignment.TopStart).padding(top = 26.dp)) {
                    MealLanguagePicker(lang.language, lang.region) { code ->
                        if (code != lang.language) {
                            lang.set(code)
                            if (micListening) startMic()
                        }
                    }
                }
            }
            FoodsGrowingSearchField(
                query,
                {
                    if (micListening) stopMic()
                    micSpoken = false
                    query = it.replace(Regex("\\s*\n\\s*"), " ")
                },
                t.t("foods.searchPlaceholder"),
                cameraLabel = t.t("foods.scanNewProduct"),
                onCamera = { nav.push("/camera?mode=product") },
            )
            voiceError?.let { HcText(it, HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center) }
            val suggestedVoice = voiceItems.filter { !it.saved }
            val savedVoice = voiceItems.filter { it.saved }
            if (suggestedVoice.isNotEmpty()) {
                Column {
                    FoodListSection(t.t("voice.suggested")) { suggestedVoice.forEachIndexed { index, entry ->
                        VoiceItemRow(
                            entry,
                            onFavorite = entry.item.productId?.let { id -> { favoriteVoiceItem(id) } },
                            onReportError = null,
                            onDelete = { deleteVoiceItem(entry) },
                            onAdd = { addVoiceItems(listOf(entry)) },
                            adding = adding,
                        )
                        if (index < suggestedVoice.lastIndex) FoodDivider()
                    } }
                    if (suggestedVoice.size > 1) {
                        HcButton(
                            if (adding) t.t("voice.adding") else t.t("voice.addShownItems"),
                            onClick = { addVoiceItems(voiceItems.filter { !it.saved }) },
                            modifier = Modifier.padding(top = 16.dp),
                            enabled = !adding,
                        )
                    }
                }
            }
            if (savedVoice.isNotEmpty()) {
                Column {
                    FoodListSection(t.t("voice.added")) { savedVoice.forEachIndexed { index, entry ->
                        VoiceItemRow(
                            entry,
                            onFavorite = entry.item.productId?.let { id -> { favoriteVoiceItem(id) } },
                            onReportError = { nav.push("/registration/${entry.id}/report-error") },
                            onDelete = { deleteVoiceItem(entry) },
                            onOpen = { nav.push("/registration/${entry.id}") },
                        )
                        if (index < savedVoice.lastIndex) FoodDivider()
                    } }
                }
            }
            if (!isSearching && ready && favorites.isNotEmpty()) {
                HcText(t.t("foods.mostUsed").uppercase(), HcTypeRoles.Small, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary, bold = true)
            }
            if (isSearching) {
                SearchCorrectionNotice(correction, onSearchInstead = { exactQuery = q }, onUseSuggestion = { query = it })
            }
            FoodListCard {
                if (waiting && skeletonDue) FoodSkeletonMediaRows(3, Modifier.padding(horizontal = 16.dp))
                if (!ready && loadFailed) {
                    HcText(connectionMessage(t, loadError, t.t("foods.loadError")), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 32.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                if (ready) {
                    visible.forEachIndexed { index, product ->
                        val isFavorite = product.id in favoriteIds
                        Column(Modifier.fillMaxWidth().clickable {
                            if (isSearching) trackSearchClick(product.id)
                            nav.push("/add/${product.id}$prefill")
                        }) {
                            FoodRow(
                                title = product.searchTitle ?: product.name,
                                image = product.imageUrl,
                                modifier = Modifier.padding(horizontal = 16.dp),
                                subtitle = {
                                    HcText(
                                        listOfNotNull(
                                            // The brand already leads a search hit's title.
                                            if (product.searchTitle != null) null else product.brand?.name,
                                            if (product.nutritionMissing) t.t("addProduct.nutritionUnknown")
                                            else t.t("foods.kcalPer100g", "kcal" to jsRound(product.kcalPer100g)),
                                        ).joinToString(" · "),
                                        HcTypeRoles.Small,
                                        color = HcColors.TextSecondary,
                                        maxLines = 1,
                                    )
                                },
                                right = {
                                    Box(Modifier.size(32.dp).clip(CircleShape).clickable { toggleFavorite(product.id, !isFavorite) }, contentAlignment = Alignment.Center) {
                                        FoodFavoriteIcon(isFavorite, 20.dp, HcColors.Green)
                                    }
                                },
                            )
                            if (index < visible.lastIndex) FoodDivider()
                        }
                    }
                    if (visible.isEmpty() && voiceItems.none { !it.saved } && !interpreting) {
                        HcText(
                            t.t(if (isSearching) "foods.noSearchMatches" else "foods.noFavoritesYet"),
                            HcTypeRoles.Body,
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 32.dp),
                            color = HcColors.TextSecondary,
                            align = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
    confirmDelete?.let { entry ->
        CaptureEntryDetailsSheet(
            title = entry.item.title,
            rows = listOf(
                CaptureDetailRow(t.t("entrySheet.amount"), entry.item.amountLabel.ifEmpty { "${entry.item.amountGrams.roundToInt()} g" }),
                CaptureDetailRow(t.t("entrySheet.energy"), "${entry.item.kcal.roundToInt()} kcal"),
            ),
            onDelete = { deleteSavedVoiceItem(entry) },
            onClose = { confirmDelete = null },
        )
    }
}

/** The Madvarer search field (.hf-search--grow): camera on the left opens the photo function, and it grows in height when the text does not fit one line. */
@Composable
private fun FoodsGrowingSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, cameraLabel: String, onCamera: () -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    val focus = LocalFocusManager.current
    Row(
        Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.Surface, shape)
            .border(1.dp, HcColors.Line, shape).padding(horizontal = HcDimens.SpaceBlock, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.clickable(onClick = onCamera)) { HcIcon("Camera", size = 22.dp, stroke = 1.8f, color = HcColors.Green, contentDescription = cameraLabel) }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = false,
            textStyle = HcTypeRoles.Input.style(HcColors.Action),
            cursorBrush = SolidColor(HcColors.Action),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { focus.clearFocus() }),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Black.copy(alpha = 0.5f), maxLines = 1)
                    inner()
                }
            },
        )
        HcIcon("Search", size = 16.dp, color = HcColors.Black)
    }
}

/**
 * Native port of src/app/foods/new/page.tsx — new products are only created
 * by scanning; old links go to the barcode flow (?for=ret kept).
 */
@Composable
fun FoodsNewScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    LaunchedEffect(Unit) {
        nav.replace(if (args.opt("for") == "ret") "/camera?mode=product&for=ret" else "/camera?mode=product")
    }
    HcLoader()
}

// ---------------------------------------------------------------------------
// /drinks and /drinks/[id] (src/lib/drinks.ts, docs/DRINKS.md).

@Serializable
data class DrinkIngredientDto(
    val id: String = "",
    val name: String = "",
    val unit: String = "",
    val defaultAmount: Double = 0.0,
    val minAmount: Double = 0.0,
    val maxAmount: Double = 0.0,
    val step: Double = 1.0,
    val kcalPer100ml: Double = 0.0,
    val proteinPer100ml: Double = 0.0,
    val carbsPer100ml: Double = 0.0,
    val fatPer100ml: Double = 0.0,
    val sugarPer100ml: Double? = null,
    val alcoholPercent: Double? = null,
)

@Serializable
data class DrinkDto(
    val id: String = "",
    val name: String = "",
    val imageUrl: String? = null,
    val description: String? = null,
    val ingredients: List<DrinkIngredientDto> = emptyList(),
)

@Serializable
private data class DrinksResponse(val drinks: List<DrinkDto> = emptyList())

private fun ingredientMl(unit: String, amount: Double) = when (unit.lowercase()) {
    "cl" -> amount * 10
    "dl" -> amount * 100
    "l" -> amount * 1000
    else -> amount
}

private fun drinkKcal(drink: DrinkDto, amounts: Map<String, Double>): Double =
    drink.ingredients.sumOf { it.kcalPer100ml * ingredientMl(it.unit, amounts[it.id] ?: 0.0) / 100 }

private suspend fun loadDrinks(): List<DrinkDto> = ApiJson.decodeFromJsonElement(DrinksResponse.serializer(), Api.get("/api/drinks")).drinks

/** Native port of src/app/drinks/page.tsx. */
@Composable
fun DrinksScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var drinks by remember { mutableStateOf<List<DrinkDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        drinks = runCatching { loadDrinks() }.getOrDefault(emptyList())
        loading = false
    }
    val suffix = listOfNotNull(args.opt("date")?.let { "date=${encodeUri(it)}" }, args.opt("time")?.let { "time=${encodeUri(it)}" })
        .joinToString("&").let { if (it.isEmpty()) "" else "?$it" }

    HcScreen(t.t("drinks.title"), icon = { HcIcon("GlassCocktail", size = 20.dp, stroke = 2f, color = HcColors.White) }, contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (loading) FoodSkeletonCards(4, 96.dp, 16.dp)
            if (!loading && drinks.isEmpty()) HcText(t.t("drinks.noDrinksYet"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            drinks.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    row.forEach { drink ->
                        HcCard(Modifier.weight(1f), onClick = { nav.push("/drinks/${drink.id}$suffix") }) {
                            Box(Modifier.size(96.dp).clip(CircleShape).background(HcColors.Cream).align(Alignment.CenterHorizontally), contentAlignment = Alignment.Center) {
                                if (drink.imageUrl != null) FoodImage(drink.imageUrl, Modifier.size(96.dp), ContentScale.Crop, thumbWidth = 384)
                                else HcIcon("GlassCocktail", size = 36.dp, color = HcColors.Black, stroke = 1.5f)
                            }
                            HcText(drink.name, HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.Black, bold = true, align = TextAlign.Center)
                        }
                    }
                    if (row.size == 1) Box(Modifier.weight(1f))
                }
            }
        }
    }
}

/** Native port of src/app/drinks/[id]/page.tsx — one slider per ingredient. */
@Composable
fun DrinkDetailScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    var drink by remember(id) { mutableStateOf<DrinkDto?>(null) }
    var loading by remember(id) { mutableStateOf(true) }
    var amounts by remember(id) { mutableStateOf(mapOf<String, Double>()) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(id) {
        val found = runCatching { loadDrinks().firstOrNull { it.id == id } }.getOrNull()
        drink = found
        if (found != null) amounts = found.ingredients.associate { it.id to it.defaultAmount }
        loading = false
    }
    val hasAmount = amounts.values.any { it > 0 }

    fun submit() {
        val d = drink ?: return
        if (!hasAmount) return
        saving = true
        saveError = null
        scope.launch {
            try {
                val date = args.opt("date")
                val time = args.opt("time")
                val createdAt = if (date != null || time != null) FoodTime.toInstant(date ?: FoodTime.currentDateString(), time ?: "12:00") else null
                val body = buildMap<String, Any> {
                    put("drinkId", d.id)
                    put("amounts", amounts)
                    if (createdAt != null) put("createdAt", createdAt.toString())
                }
                Api.post("/api/drinks/log", body)
                NativeHooks.onRegistrationChanged()
                if (!nav.back()) nav.resetTo("/")
            } catch (_: Exception) {
                saveError = t.t("drinks.saveError")
            }
            saving = false
        }
    }

    HcScreen(drink?.name ?: t.t("drinks.title"), icon = { HcIcon("GlassCocktail", size = 20.dp, stroke = 2f, color = HcColors.White) }, contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (loading) Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { FoodSkeleton(Modifier.size(180.dp), CircleShape) }
            if (!loading && drink == null) HcText(t.t("drinks.notFound"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            val d = drink
            if (d != null) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(180.dp).clip(CircleShape).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                        if (d.imageUrl != null) FoodImage(d.imageUrl, Modifier.size(180.dp), ContentScale.Crop, contentDescription = d.name, thumbWidth = 640)
                        else HcIcon("GlassCocktail", size = 72.dp, color = HcColors.Black, stroke = 1.25f)
                    }
                }
                d.ingredients.forEach { ingredient ->
                    val value = amounts[ingredient.id] ?: 0.0
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Card).padding(HcDimens.SpaceBlock),
                        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
                    ) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                            HcText(ingredient.name, HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.Black, bold = true)
                            HcText("${daNumber(value, 2)} ${ingredient.unit}", HcTypeRoles.Title, color = HcColors.Black)
                        }
                        FoodSlider(
                            value = value,
                            min = ingredient.minAmount,
                            max = ingredient.maxAmount,
                            step = ingredient.step.takeIf { it > 0 } ?: 1.0,
                            onChange = { amounts = amounts + (ingredient.id to it) },
                        )
                    }
                }
                HcText(t.t("drinks.kcalTotal", "kcal" to jsRound(drinkKcal(d, amounts))), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                saveError?.let { HcText(it, HcTypeRoles.Caption, Modifier.fillMaxWidth(), align = TextAlign.Center) }
                HcButton(if (saving) t.t("drinks.saving") else t.t("drinks.add"), onClick = ::submit, enabled = !saving && hasAmount)
            }
        }
    }
}

package dk.packroff.hellocal.screens.food

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.capture.CaptureHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.FoodScrollSheet
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.foodSelected
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Pieces of src/components/add/AddProductView.tsx and the hf/* components it uses.

/** Section label in the info sheets (hf-type-small text-text-secondary hf-heading uppercase). */
@Composable
private fun InfoLabel(text: String) {
    HcText(text.uppercase(), HcTypeRoles.Small, color = HcColors.TextSecondary, bold = true)
}

/** src/components/hf/AdditiveInfoModal.tsx (hard-coded Danish like the web). */
@Composable
fun AdditiveInfoSheet(code: String, onClose: () -> Unit) {
    val nav = LocalNavigator.current
    var info by remember(code) { mutableStateOf<AdditiveInfo?>(null) }
    LaunchedEffect(code) { info = Additives.info(code) }
    val current = info
    FoodScrollSheet(onDismiss = onClose) {
        val title = code.uppercase() + (current?.internationalName?.takeIf { it.isNotEmpty() }?.let { " · $it" } ?: "")
        HcText(title, HcTypeRoles.Body, Modifier.padding(bottom = 12.dp), color = HcColors.Black, bold = true)
        if (current == null) {
            HcText("Henter...", HcTypeRoles.Body, color = HcColors.TextSecondary)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (current.danishName.isNotEmpty()) HcText(current.danishName, HcTypeRoles.Small, color = HcColors.TextSecondary)
                if (current.function.isNotEmpty()) HcText(current.function, HcTypeRoles.Body, color = HcColors.Black)
                if (current.risks.isNotEmpty()) Column {
                    InfoLabel("Risici")
                    HcText(current.risks, HcTypeRoles.Body, color = HcColors.Black)
                }
                if (current.research.isNotEmpty()) Column {
                    InfoLabel("Forskning")
                    HcText(current.research, HcTypeRoles.Body, color = HcColors.Black)
                }
                if (current.link.isNotEmpty()) {
                    HcText(
                        "Læs mere (${current.source.ifEmpty { "kilde" }})",
                        HcTypeRoles.Small,
                        Modifier.clickable { NativeHooks.openExternalUrl(current.link) },
                        color = HcColors.Green,
                        underline = true,
                    )
                }
                HcText(
                    "Læs hele beskrivelsen med forskning og kilder om stoffet",
                    HcTypeRoles.Small,
                    Modifier.clickable {
                        onClose()
                        nav.push("/e-numre/${encodeUri(code.uppercase())}")
                    },
                    color = HcColors.Green,
                    bold = true,
                    underline = true,
                )
            }
        }
        HcText(
            "Generel baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig kostrådgivning.",
            HcTypeRoles.Small,
            Modifier.padding(top = 16.dp),
            color = HcColors.TextSecondary,
        )
    }
}

/** src/components/hf/ToxinInfoModal.tsx */
@Composable
fun ToxinInfoSheet(toxin: ToxinInfo, onClose: () -> Unit) {
    FoodScrollSheet(onDismiss = onClose) {
        HcText(toxin.name, HcTypeRoles.Body, Modifier.padding(bottom = 12.dp), color = HcColors.Black, bold = true)
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HcText(toxin.foods, HcTypeRoles.Small, color = HcColors.TextSecondary)
            HcText(toxin.description, HcTypeRoles.Body, color = HcColors.Black)
            toxin.pregnancy?.let {
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(HcColors.Tan).padding(horizontal = 12.dp, vertical = 10.dp)) {
                    InfoLabel("Gravid eller ammende")
                    HcText(it, HcTypeRoles.Body, color = HcColors.Black)
                }
            }
            toxin.fertility?.let {
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(HcColors.Tan).padding(horizontal = 12.dp, vertical = 10.dp)) {
                    InfoLabel("Når du prøver at blive gravid")
                    HcText(it, HcTypeRoles.Body, color = HcColors.Black)
                }
            }
            Column {
                InfoLabel("Råd")
                HcText(toxin.advice, HcTypeRoles.Body, color = HcColors.Black)
            }
            toxin.links.forEach { link ->
                HcText(link.label, HcTypeRoles.Small, Modifier.clickable { NativeHooks.openExternalUrl(link.url) }, color = HcColors.Green, underline = true)
            }
        }
        HcText(
            "Vist fordi indholdsfortegnelsen nævner en fødevare, der er kendt for stoffet — ikke en måling af netop denne vare. Generel information fra Fødevarestyrelsen og EFSA, ikke personlig kostrådgivning.",
            HcTypeRoles.Small,
            Modifier.padding(top = 16.dp),
            color = HcColors.TextSecondary,
        )
    }
}

/** src/components/hf/MicronutrientInfoModal.tsx */
@Composable
fun MicronutrientInfoSheet(nutrientKey: String, onClose: () -> Unit) {
    val nav = LocalNavigator.current
    val info = FoodReferenceData.micronutrientByKey[nutrientKey] ?: return
    FoodScrollSheet(onDismiss = onClose) {
        HcText(info.name, HcTypeRoles.Body, Modifier.padding(bottom = 12.dp), color = HcColors.Black, bold = true)
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcText(info.alsoKnownAs, HcTypeRoles.Small, color = HcColors.TextSecondary)
            HcText(info.function, HcTypeRoles.Body, color = HcColors.Black)
            Column {
                InfoLabel("Findes i")
                HcText(info.sources, HcTypeRoles.Body, color = HcColors.Black)
            }
            Column {
                InfoLabel("Referenceindtag")
                HcText(info.referenceIntake, HcTypeRoles.Body, color = HcColors.Black)
            }
            HcText(
                "Se hele siden med kilder",
                HcTypeRoles.Small,
                Modifier.clickable {
                    onClose()
                    nav.push("/vitaminer#${info.key.lowercase()}")
                },
                color = HcColors.Green,
                bold = true,
                underline = true,
            )
        }
        HcText("Generel baggrundsinformation — ikke personlig kostrådgivning.", HcTypeRoles.Small, Modifier.padding(top = 16.dp), color = HcColors.TextSecondary)
    }
}

/**
 * src/components/hf/IngredientsText.tsx + splitENumbers: allergens in bold
 * UPPERCASE, E-numbers as links (info sheet), "Mad på latin" words as quiet links.
 */
@Composable
fun IngredientsTextView(text: String, onAdditive: (String) -> Unit) {
    val nav = LocalNavigator.current
    val annotated = remember(text) {
        buildAnnotatedString {
            for (part in splitENumbers(displayIngredientsText(text))) {
                val code = part.code
                if (code != null) {
                    withLink(
                        LinkAnnotation.Clickable(
                            tag = "e:$code",
                            styles = TextLinkStyles(SpanStyle(color = HcColors.Black, fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline)),
                        ) { onAdditive(code) },
                    ) { append(part.text) }
                    continue
                }
                for (segment in segmentIngredients(part.text)) {
                    for (termPart in splitFoodTerms(segment.text)) {
                        val shown = if (segment.allergen) termPart.text.uppercase() else termPart.text
                        val term = termPart.term
                        val style = if (segment.allergen) SpanStyle(fontWeight = FontWeight.Bold) else SpanStyle()
                        if (term != null) {
                            withLink(LinkAnnotation.Clickable(tag = "t:$term", styles = TextLinkStyles(style)) { nav.push(foodTermHref(term)) }) { append(shown) }
                        } else {
                            withStyle(style) { append(shown) }
                        }
                    }
                }
            }
        }
    }
    Text(annotated, style = HcTypeRoles.Small.style(HcColors.TextSecondary))
}

/** src/components/hf/CertificationLogos.tsx — label logos, right-aligned, 44 px high. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun CertificationLogosRow(badges: List<CertificationBadge>, modifier: Modifier = Modifier) {
    if (badges.isEmpty()) return
    androidx.compose.foundation.layout.FlowRow(
        modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        badges.forEach { badge ->
            val src = certificationLogoSrc(badge.kind) ?: badge.imageUrl
            if (src == null) {
                Box(Modifier.height(44.dp).clip(RoundedCornerShape(50)).background(HcColors.GrayLight).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                    HcText(badge.label, HcTypeRoles.Small, color = HcColors.Black, bold = true)
                }
            } else {
                FoodImage(src, Modifier.height(44.dp).widthIn(max = 120.dp), contentScale = ContentScale.FillHeight, contentDescription = badge.label)
            }
        }
    }
}

/** src/components/hf/HandSizePicker.tsx — Lille / Normal / Stor. */
@Composable
fun HandSizePickerRow(item: HandSizeItem, imageUrl: String?, amount: Double, onSelect: (Double) -> Unit) {
    val t = LocalTranslator.current
    val largest = 76f
    Row(Modifier.fillMaxWidth().widthIn(max = 320.dp).padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item.sizes.forEach { size ->
            val selected = jsRound(amount).toInt() == size.grams
            val shape = RoundedCornerShape(16.dp)
            Column(
                Modifier.weight(1f).clip(shape).foodSelected(selected, shape).clickable { onSelect(size.grams.toDouble()) }.padding(horizontal = 4.dp, vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.Bottom),
            ) {
                if (imageUrl != null) {
                    Box(Modifier.fillMaxWidth().height(largest.dp), contentAlignment = Alignment.BottomCenter) {
                        FoodImage(imageUrl, Modifier.height((largest * handSizeImageScale(size, item)).toFloat().dp))
                    }
                }
                val labelKey = when (size.key) {
                    "small" -> "addProduct.sizeSmall"
                    "medium" -> "addProduct.sizeMedium"
                    else -> "addProduct.sizeLarge"
                }
                HcText(t.t(labelKey), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                HcText(formatHandSizeDimensions(size), HcTypeRoles.Micro, color = HcColors.Black)
                HcText("${size.wholeGrams} g", HcTypeRoles.Micro, color = HcColors.Black, bold = true)
                if (size.grams != size.wholeGrams) {
                    HcText("${size.grams} g ${t.t("addProduct.refuse.${item.refuseKey}")}", HcTypeRoles.Micro, color = HcColors.Black, align = TextAlign.Center)
                }
            }
        }
    }
}

/** One photo box in [UpdatePointsBanner]; [retake] = the unreadable ingredients are taken again. */
data class UpdateTile(val kind: String, val label: String, val retake: Boolean = false)

/**
 * Opens the phone's camera for [tile] and sends the photo (web: UpdateCameraPanel):
 * POST /api/products/[id]/update, or /ingredients-photo for a retake. Returns
 * (outcome, points) — outcome "done" | "unreadable" | "error" — or null when the
 * user cancelled the camera. [onStart] runs once a photo was taken.
 */
private suspend fun captureUpdatePhoto(productId: String, tile: UpdateTile, onStart: () -> Unit): Pair<String, Int>? {
    // The front is also kept in full resolution (web: fullPhoto, DECISIONS 2026-10-15).
    val takeFull = CaptureHooks.takeFullPhoto
    var fullPhoto: FoodPhoto? = null
    val photo = if (tile.kind == "FRONT" && takeFull != null) {
        val full = runCatching { takeFull() }.getOrNull() ?: return null
        fullPhoto = FoodPhoto(full)
        FoodPhoto(CaptureHooks.scaleForUpload(full) ?: full)
    } else {
        FoodPlatform.photo(fromGallery = false) ?: return null
    }
    onStart()
    return try {
        if (tile.retake) {
            val data = Api.post("/api/products/${encodeUri(productId)}/ingredients-photo", mapOf("photo" to photo.dataUrl()))
            (if (data.bool("ingredientsFound") == true) "done" else "unreadable") to 0
        } else {
            val body = buildMap<String, Any> {
                put("kind", tile.kind)
                put("photo", photo.dataUrl())
                fullPhoto?.let { put("fullPhoto", it.dataUrl()) }
                put("photoTakenAt", photo.takenAtMillis ?: FoodTime.now().toEpochMilliseconds())
            }
            val data = Api.post("/api/products/${encodeUri(productId)}/update", body)
            (if (data.bool("accepted") == true) "done" else "unreadable") to (data.num("pointsAwarded")?.toInt() ?: 0)
        }
    } catch (_: Exception) {
        "error" to 0
    }
}

/**
 * src/components/hf/UpdatePointsBanner.tsx — white overlay under the app bar
 * ("Optjen 20 points …"); it floats over the page and never pushes it. The grip
 * collapses it (drag up / tap) or pulls down an inverted popup with one camera
 * tile per missing item (drag down, or tap the text). The closed strip is text
 * only — the photo tiles appear only once it is pulled down (user rule
 * 2026-10-15). A tile opens the phone's own camera right away and the photo is
 * read in place — never a new page (user rule 2026-10-15; the web shows its live
 * viewfinder in the panel, src/components/hf/UpdateCameraPanel.tsx). Place it
 * inside a Box over the content.
 * [scrollOffset] is the page's scroll position: scrolling down folds the banner
 * to its grip, reaching the top again unfolds it to what it was — unless the
 * user folded it themselves (user rule 2026-10-15).
 */
@Composable
fun UpdatePointsBanner(
    productId: String,
    text: String,
    toggleLabel: String,
    tiles: List<UpdateTile>,
    onUpdated: () -> Unit,
    scrollOffset: Int = 0,
) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var workingKind by remember { mutableStateOf<String?>(null) }
    var outcomes by remember { mutableStateOf(mapOf<String, String>()) }
    var earned by remember { mutableStateOf(0) }
    // 0 = collapsed, 1 = banner, 2 = panel
    var stage by remember { mutableStateOf(1) }
    // The stage before scrolling folded it; null when scrolling did not fold it.
    var restoreTo by remember { mutableStateOf<Int?>(null) }
    var lastOffset by remember { mutableStateOf(scrollOffset) }
    val collapseAfterPx = with(LocalDensity.current) { 24.dp.roundToPx() }
    LaunchedEffect(scrollOffset) {
        if (scrollOffset > lastOffset && scrollOffset > collapseAfterPx) {
            if (stage != 0) {
                restoreTo = stage
                stage = 0
            }
        } else if (scrollOffset <= 0) {
            restoreTo?.let { stage = it }
            restoreTo = null
        }
        lastOffset = scrollOffset
    }
    val bannerShape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp)
    Column(Modifier.fillMaxWidth().shadow(4.dp, bannerShape).background(HcColors.White, bannerShape)) {
        // Text and tiles slide up and down instead of snapping (user rule 2026-10-15).
        val enter = expandVertically(tween(300)) + fadeIn(tween(300))
        val exit = shrinkVertically(tween(300)) + fadeOut(tween(300))
        AnimatedVisibility(stage >= 1, enter = enter, exit = exit) {
            HcText(
                text,
                HcTypeRoles.Small,
                Modifier.fillMaxWidth().clickable {
                    restoreTo = null
                    stage = 2
                }.padding(start = 16.dp, end = 16.dp, top = 12.dp),
                color = HcColors.Black,
                bold = true,
                align = TextAlign.Center,
            )
        }
        AnimatedVisibility(stage == 2, enter = enter, exit = exit) {
            Column(
                Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally)) {
                    tiles.forEach { tile ->
                        val done = outcomes[tile.kind] == "done"
                        Column(
                            Modifier.width(96.dp).clickable(enabled = workingKind == null && !done) {
                                scope.launch {
                                    val result = captureUpdatePhoto(productId, tile, onStart = { workingKind = tile.kind }) ?: return@launch
                                    workingKind = null
                                    outcomes = outcomes + (tile.kind to result.first)
                                    earned += result.second
                                    if (tiles.all { outcomes[it.kind] == "done" }) {
                                        delay(2500)
                                        onUpdated()
                                    }
                                }
                            },
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Box(
                                Modifier.size(96.dp).clip(RoundedCornerShape(16.dp)).background(HcColors.Page),
                                contentAlignment = Alignment.Center,
                            ) {
                                when {
                                    workingKind == tile.kind -> HcLoader(Modifier)
                                    done -> HcIcon("Check", size = 32.dp, color = HcColors.Black)
                                    else -> HcIcon("Camera", size = 32.dp, color = HcColors.Black)
                                }
                            }
                            HcText(tile.label, HcTypeRoles.Small, color = HcColors.Black, align = TextAlign.Center)
                        }
                    }
                }
                val caption = when {
                    workingKind != null -> t.t("productUpdate.reading")
                    earned > 0 -> t.t("productUpdate.earned", "points" to earned)
                    outcomes.values.lastOrNull() == "done" -> t.t("productUpdate.done")
                    outcomes.values.lastOrNull() == "unreadable" -> t.t("productUpdate.unreadable")
                    outcomes.values.lastOrNull() == "error" -> t.t("productUpdate.error")
                    else -> null
                }
                caption?.let { HcText(it, HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.Black, align = TextAlign.Center) }
            }
        }
        Box(
            Modifier.fillMaxWidth().height(20.dp)
                .clickable {
                    restoreTo = null
                    stage = if (stage == 1) 0 else 1
                }
                .pointerInput(Unit) {
                    var total = 0f
                    detectVerticalDragGestures(
                        onDragStart = { total = 0f },
                        onDragEnd = {
                            restoreTo = null
                            if (total >= 16 * density) stage = if (stage == 0) 1 else 2
                            else if (total <= -16 * density) stage = if (stage == 2) 1 else 0
                        },
                    ) { change, amount ->
                        change.consume()
                        total += amount
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(40.dp, 4.dp).clip(RoundedCornerShape(50)).background(HcColors.Inactive))
        }
    }
}

/**
 * src/components/ForwardButton.tsx — "Videresend til en ven": POST /api/forwards
 * and share the link (system share sheet, else copy to the clipboard).
 */
@Composable
fun ForwardButton(kind: String, itemId: String, name: String) {
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        error?.let { HcText(it, HcTypeRoles.Small, color = HcColors.RedDark, maxLines = 1) }
        Box(
            Modifier.size(44.dp).clip(CircleShape).clickable(enabled = !sending) {
                sending = true
                error = null
                scope.launch {
                    try {
                        val body = if (kind == "PRODUCT") mapOf("kind" to kind, "productId" to itemId) else mapOf("kind" to kind, "dishId" to itemId)
                        val created = Api.post("/api/forwards", body)
                        val token = created.obj("forward").str("token")
                        if (token != null) {
                            val url = created.str("link") ?: "${HelloCalConfig.BASE_URL}/forward/$token"
                            val shared = FoodPlatform.share?.invoke(name, "Prøv \"$name\" i Hello Cal!", url) == true
                            if (!shared) clipboard.setText(AnnotatedString(url))
                        }
                    } catch (e: dk.packroff.hellocal.api.ApiException) {
                        error = e.body.str("message") ?: "Kunne ikke videresende"
                    } catch (_: Exception) {
                        error = "Kunne ikke videresende"
                    }
                    sending = false
                }
            },
            contentAlignment = Alignment.Center,
        ) {
            HcIcon("Share3", size = 24.dp, color = HcColors.Black.copy(alpha = if (sending) 0.5f else 1f))
        }
    }
}

/** Fixed-width spacer used by the amount stepper's −/+ glyph buttons. */
@Composable
fun GlyphButton(glyph: String, onClick: () -> Unit, size: Dp = 44.dp) {
    Box(Modifier.size(size).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Text(glyph, style = HcTypeRoles.PageTitle.style(HcColors.Black).copy(fontWeight = FontWeight.Bold, fontSize = 34.sp))
    }
}

/** Animated chevron used by fold-outs (IconChevronDown with rotate-180 when open). */
@Composable
fun FoldChevron(open: Boolean, size: Dp = 15.dp) {
    val rotation by animateFloatAsState(if (open) 180f else 0f)
    Box(Modifier.size(size).rotate(rotation)) { HcIcon("ChevronDown", size = size, color = HcColors.Black) }
}

package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodDetailRow
import dk.packroff.hellocal.ui.FoodDivider
import dk.packroff.hellocal.ui.FoodEntryDetailsSheet
import dk.packroff.hellocal.ui.FoodNotice
import dk.packroff.hellocal.ui.FoodRow
import dk.packroff.hellocal.ui.FoodSkeletonMediaRows
import dk.packroff.hellocal.ui.FoodSwipeTexts
import dk.packroff.hellocal.ui.FoodSwipeableRow
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class DailyEntry(
    val id: String,
    val title: String,
    val kcalPer100g: Double,
    val kcal: Double,
    val amountGrams: Double,
    val createdAt: String,
    val image: String?,
    val productId: String?,
)

/** src/components/DailyList.tsx — "Dagens tilføjelser" on the front page. */
@Composable
fun HomeDailyList(modifier: Modifier = Modifier) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var entries by remember { mutableStateOf<List<DailyEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var copyingId by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf<DailyEntry?>(null) }
    var hasScans by remember { mutableStateOf(false) }
    val status = FoodFamily.status
    // "Kopier til konto" only on own entries, only when controlling other profiles (docs/FAMILY.md).
    val copyTargets = if (status != null && status.activeProfile.id == status.me.id) {
        status.profiles.filter { it.id != status.me.id && it.canWrite }
    } else emptyList()

    LaunchedEffect(Unit) {
        try {
            val data = ApiJson.decodeFromJsonElement(RegistrationsResponse.serializer(), Api.get("/api/registrations"))
            entries = data.registrations.filter { FoodTime.isToday(it.createdAt) }.map { r ->
                DailyEntry(
                    id = r.id,
                    title = r.titleSnapshot,
                    kcalPer100g = if (r.amountGrams > 0) r.kcalSnapshot / r.amountGrams * 100 else r.kcalSnapshot,
                    kcal = r.kcalSnapshot,
                    amountGrams = r.amountGrams,
                    createdAt = r.createdAt,
                    image = r.product?.imageUrl,
                    productId = r.productId,
                )
            }
        } catch (e: Exception) {
            error = connectionMessage(t, e, t.t("dailyList.loadError"))
        }
        loading = false
    }

    LaunchedEffect(Unit) {
        runCatching {
            val scans = Api.get("/api/my-scans").arr("scans")
            hasScans = (scans?.size ?: 0) > 0
        }
    }

    LaunchedEffect(notice) {
        if (notice != null) {
            delay(2500)
            notice = null
        }
    }

    fun favoriteEntry(productId: String?) {
        if (productId == null) return
        scope.launch { runCatching { Api.post("/api/favorites", mapOf("productId" to productId)) } }
    }

    fun copyEntry(registrationId: String, target: FamilyProfile) {
        copyingId = null
        scope.launch {
            val ok = runCatching {
                Api.post("/api/family/copy-registration", mapOf("registrationId" to registrationId, "targetProfileId" to target.id))
            }.isSuccess
            notice = if (ok) t.t("family.copy.done", "name" to target.displayName) else t.t("family.copy.failed")
        }
    }

    fun startCopy(registrationId: String) {
        if (copyTargets.size == 1) copyEntry(registrationId, copyTargets.first()) else copyingId = registrationId
    }

    fun deleteEntry(id: String) {
        val previous = entries
        entries = entries.filter { it.id != id }
        scope.launch {
            try {
                Api.delete("/api/registrations/$id")
                NativeHooks.onRegistrationChanged()
            } catch (e: ApiException) {
                entries = previous
                error = if (e.status == 403) t.t("family.deletePermissions.notAllowed") else t.t("dailyList.deleteError")
            } catch (e: Exception) {
                entries = previous
                error = t.t("dailyList.deleteError")
            }
        }
    }

    val swipeTexts = FoodSwipeTexts(
        favorite = t.t("swipeableRow.favorite"),
        copy = t.t("family.copy.action"),
        reportError = t.t("swipeableRow.reportError"),
        delete = t.t("swipeableRow.delete"),
    )

    Box(modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            HcSectionTitle(t.t("dailyList.heading"), Modifier.padding(horizontal = 16.dp))
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 36.dp)) {
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Column(Modifier.fillMaxWidth().let { if (entries.isNotEmpty()) it.clip(shape).background(HcColors.Tan) else it }) {
                    entries.forEachIndexed { i, entry ->
                        FoodSwipeableRow(
                            texts = swipeTexts,
                            surface = HcColors.Tan,
                            onFavorite = if (entry.productId != null) ({ favoriteEntry(entry.productId) }) else null,
                            onCopyToAccount = if (copyTargets.isNotEmpty()) ({ startCopy(entry.id) }) else null,
                            onReportError = { nav.push("/registration/${entry.id}/report-error") },
                            onDelete = { confirmDelete = entry },
                        ) {
                            FoodRow(
                                title = entry.title,
                                image = entry.image,
                                modifier = Modifier.clickable { nav.push("/registration/${entry.id}") }.padding(horizontal = 16.dp),
                                overline = { HcText(t.t("dailyList.atTime", "time" to FoodTime.hhmm(entry.createdAt)), HcTypeRoles.Small, color = HcColors.Black, bold = true) },
                                subtitle = { HcText("${jsRound(entry.kcalPer100g)} kcal / 100 g", HcTypeRoles.Small, Modifier.padding(top = 4.dp), color = HcColors.TextSecondary) },
                                right = { HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black.copy(alpha = 0.4f)) },
                            )
                        }
                        if (i < entries.lastIndex) FoodDivider()
                    }
                    if (loading) FoodSkeletonMediaRows(4)
                    if (!loading && entries.isEmpty()) {
                        HcText(t.t("dailyList.noEntriesToday"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(vertical = 32.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                    }
                    error?.let {
                        HcText(it, HcTypeRoles.Small, Modifier.fillMaxWidth().padding(bottom = 16.dp), color = HcColors.RedDark, align = TextAlign.Center)
                    }
                }
                if (hasScans && !loading) {
                    Row(
                        Modifier.fillMaxWidth().padding(top = if (entries.isNotEmpty()) 12.dp else 0.dp),
                        horizontalArrangement = if (entries.isNotEmpty()) Arrangement.Start else Arrangement.Center,
                    ) { HcLink(t.t("dailyList.seeScans"), "/my-scans") }
                }
            }
        }
        notice?.let { FoodNotice(it, Modifier.align(Alignment.BottomCenter).padding(horizontal = 16.dp).padding(bottom = 40.dp)) }
        // Soft fade at the bottom of the list (hf-fade-bottom).
        Box(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(36.dp)
                .background(Brush.verticalGradient(listOf(Color.Transparent, HcColors.Page))),
        )
    }

    confirmDelete?.let { entry ->
        FoodEntryDetailsSheet(
            title = entry.title,
            subtitle = t.t("dailyList.atTime", "time" to FoodTime.hhmm(entry.createdAt)),
            rows = listOf(
                FoodDetailRow(t.t("entrySheet.amount"), "${jsRound(entry.amountGrams)} g"),
                FoodDetailRow(t.t("entrySheet.energy"), "${jsRound(entry.kcal)} kcal"),
            ),
            deleteLabel = t.t("entrySheet.delete"),
            cancelLabel = t.t("common.cancel"),
            closeLabel = t.t("common.close"),
            deleteWarning = t.t("entrySheet.deleteWarning"),
            onDelete = { deleteEntry(entry.id) },
            onClose = { confirmDelete = null },
        )
    }

    copyingId?.let { id ->
        FoodCopyToAccountSheet(copyTargets, onChoose = { copyEntry(id, it) }, onClose = { copyingId = null })
    }
}

/** src/components/family/CopyToAccountSheet.tsx */
@Composable
fun FoodCopyToAccountSheet(profiles: List<FamilyProfile>, onChoose: (FamilyProfile) -> Unit, onClose: () -> Unit) {
    val t = LocalTranslator.current
    dk.packroff.hellocal.ui.HcBottomSheet(onDismiss = onClose) {
        profiles.forEach { profile ->
            Row(
                Modifier.fillMaxWidth().height(56.dp).clickable { onChoose(profile) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                dk.packroff.hellocal.ui.FoodProfileCircle(profile.displayName, tone = dk.packroff.hellocal.ui.FoodProfileTone.Card)
                HcText(profile.displayName, HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
            }
            FoodDivider()
        }
        dk.packroff.hellocal.ui.VSpace(16.dp)
        dk.packroff.hellocal.ui.HcButton(t.t("common.cancel"), onClick = onClose, kind = dk.packroff.hellocal.ui.HcButtonKind.Secondary)
    }
}

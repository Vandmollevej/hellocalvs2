package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.ui.ProfileCircleTone
import dk.packroff.hellocal.ui.ProfileCircle
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcChoiceChip
import dk.packroff.hellocal.ui.CaptureDatePickerSheet
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureFilledField
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.CaptureValueField
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcSheetSkipButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.icons.HcIcon
import io.ktor.http.HttpMethod
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.plus
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

// --- GET /api/family (components/family/FamilyStatusProvider.tsx) ---------------

@Serializable
internal data class FamilyMe(val id: String, val displayName: String = "")

@Serializable
internal data class FamilyMemberInfo(
    val userId: String,
    val displayName: String = "",
    val isChild: Boolean = false,
    val age: Int? = null,
    val hasLogin: Boolean = false,
    val createdByOwner: Boolean = false,
    val controllerId: String = "",
    val canDeleteOthersEntries: Boolean = false,
)

@Serializable
internal data class FamilyGrant(val granteeId: String, val subjectId: String, val canWrite: Boolean = false)

@Serializable
internal data class FamilyInfo(
    val id: String,
    val ownerId: String,
    val ownerName: String = "",
    val isOwner: Boolean = false,
    val extraSeats: Int = 0,
    val maxExtraSeats: Int = 0,
    val capacity: Int = 0,
    val members: List<FamilyMemberInfo> = emptyList(),
    val grants: List<FamilyGrant> = emptyList(),
)

@Serializable
internal data class FamilyStatus(
    val me: FamilyMe,
    val meIsChild: Boolean = false,
    val family: FamilyInfo? = null,
    val hasFamilyPlan: Boolean = false,
    val maxProfiles: Int = 0,
)

/** fetch() + json like the family page's send(): ok flag and the response body (also on errors). */
internal suspend fun familySend(path: String, method: HttpMethod, body: Any? = null): Pair<Boolean, JsonObject> = try {
    val result = Api.send(method, path, body)
    true to ((result as? JsonObject) ?: JsonObject(emptyMap()))
} catch (e: ApiException) {
    false to ((e.body as? JsonObject) ?: JsonObject(emptyMap()))
} catch (e: Exception) {
    false to JsonObject(emptyMap())
}

internal fun familyErrorText(data: JsonObject, t: Translator): String =
    t.t("family.error.${data["code"]?.jsonPrimitive?.contentOrNull ?: "unknown"}")

// Initials and the profile circle are the shared ui ones (initialsOf, ProfileCircle tone Card).

/** AccessToggles — "see" and "write" switches that follow each other. */
@Composable
internal fun AccessToggles(level: String, onChange: (String) -> Unit, enabled: Boolean = true) {
    val t = LocalTranslator.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcToggle(
            checked = level != "none",
            onChange = { on -> onChange(if (on) (if (level == "none") "read" else level) else "none") },
            label = t.t("family.rights.see"),
            enabled = enabled,
        )
        HcToggle(
            checked = level == "write",
            onChange = { on -> onChange(if (on) "write" else if (level == "none") "none" else "read") },
            label = t.t("family.rights.write"),
            enabled = enabled,
        )
    }
}

internal data class FamilyProfileInput(
    val displayName: String = "",
    val birthDate: String = "",
    val sex: String = "",
    val isChild: Boolean = true,
    val heightCm: String = "",
    val weightKg: String = "",
) {
    fun toBody(): Map<String, Any> = mapOf(
        "displayName" to displayName,
        "birthDate" to birthDate,
        "sex" to sex,
        "isChild" to isChild,
        "heightCm" to heightCm,
        "weightKg" to weightKg,
    )
}

/** Name, birth date, sex, height and weight fields shared by the add forms. */
@Composable
internal fun FamilyProfileFields(form: FamilyProfileInput, onChange: (FamilyProfileInput) -> Unit) {
    val t = LocalTranslator.current
    var picking by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcTextField(form.displayName, { onChange(form.copy(displayName = it)) }, label = t.t("family.add.name"), standard = true)
        HcText(t.t("family.add.birthDate"), HcTypeRoles.Label)
        val date = CaptureDates.parseDate(form.birthDate)
        CaptureValueField(date?.let { CaptureDates.dayMonthShort(it, withYear = true, locale = t.locale) } ?: "", onClick = { picking = true }, background = HcColors.Cream)
        HcText(t.t("family.add.sex"), HcTypeRoles.Body)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("" to "family.add.sexUnknown", "FEMALE" to "family.add.sexFemale", "MALE" to "family.add.sexMale").forEach { (value, key) ->
                HcChoiceChip(t.t(key), selected = form.sex == value, onClick = { onChange(form.copy(sex = value)) }, modifier = Modifier.weight(1f))
            }
        }
        HcTextField(form.heightCm, { onChange(form.copy(heightCm = it)) }, label = t.t("family.add.heightCm"), keyboardType = KeyboardType.Decimal, standard = true)
        HcTextField(form.weightKg, { onChange(form.copy(weightKg = it)) }, label = t.t("family.add.weightKg"), keyboardType = KeyboardType.Decimal, standard = true)
    }
    if (picking) {
        CaptureDatePickerSheet(
            initial = CaptureDates.parseDate(form.birthDate) ?: CaptureDates.today(),
            max = CaptureDates.today(),
            onPick = { onChange(form.copy(birthDate = CaptureDates.isoDate(it))) },
            onDismiss = { picking = false },
            title = t.t("family.add.birthDate"),
        )
    }
}

private fun isUnder18(birthDate: String): Boolean {
    val date = CaptureDates.parseDate(birthDate) ?: return true
    return date.plus(DatePeriod(years = 18)) > CaptureDates.today()
}

/** src/components/family/FamilyProfileForm.tsx — a new profile in the family. */
@Composable
internal fun FamilyProfileForm(
    busy: Boolean,
    onSubmit: suspend (FamilyProfileInput) -> Boolean,
    onCancel: () -> Unit,
    childOnly: Boolean = false,
    memberOnly: Boolean = false,
) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var form by remember { mutableStateOf(FamilyProfileInput()) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FamilyProfileFields(form) { form = it }
        if (!childOnly && !memberOnly) {
            HcToggle(
                checked = form.isChild,
                onChange = { form = form.copy(isChild = it) },
                label = t.t("family.add.isChild"),
                description = t.t("family.add.isChildHelp"),
            )
        }
        error?.let { HcText(it, HcTypeRoles.Body, color = HcColors.RedDark) }
        HcButton(
            t.t(if (childOnly) "family.add.submitChild" else if (memberOnly) "family.add.addMember" else "family.add.submit"),
            onClick = {
                error = null
                if (childOnly && form.birthDate.isNotEmpty() && !isUnder18(form.birthDate)) {
                    error = t.t("family.add.childTooOld")
                } else {
                    val input = form.copy(isChild = if (childOnly) true else if (memberOnly) false else form.isChild)
                    scope.launch { if (onSubmit(input)) form = FamilyProfileInput() }
                }
            },
            enabled = !busy && form.displayName.isNotBlank(),
        )
        HcButton(t.t("common.cancel"), onClick = onCancel, kind = HcButtonKind.Text)
    }
}

private val SHARED_PROFILE_AREAS = listOf(
    "profile", "registrations", "water", "weight", "activities", "bodyMeasurements", "goals", "sleep",
    "healthMetrics", "menstrualCycle", "workShifts", "favorites",
)

/** src/components/family/FamilySharingSection.tsx — "Delt med {navn}" per person who can see my profile. */
@Composable
internal fun FamilySharingSection(family: FamilyInfo, meId: String) {
    val t = LocalTranslator.current
    var openId by remember { mutableStateOf<String?>(null) }
    // src/lib/family-sharing.ts peopleSharedWith
    val people = buildList {
        if (family.ownerId != meId) add(Triple(family.ownerId, family.ownerName, true))
        family.members.forEach { m ->
            if (m.userId != meId && m.userId != family.ownerId && family.grants.any { it.granteeId == m.userId && it.subjectId == meId }) {
                add(Triple(m.userId, m.displayName, false))
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcSectionTitle(t.t("family.sharing.title"))
        HcText(t.t("family.sharing.intro", "owner" to family.ownerName), HcTypeRoles.Body)
        if (people.isEmpty()) {
            HcText(t.t("family.sharing.none"), HcTypeRoles.Body, color = HcColors.TextSecondary)
        } else {
            val shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                people.forEachIndexed { index, (userId, name, isOwner) ->
                    val open = openId == userId
                    Row(
                        Modifier.fillMaxWidth().height(56.dp).clickable { openId = if (open) null else userId }.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        ProfileCircle(name, tone = ProfileCircleTone.Card)
                        HcText(t.t("family.sharing.sharedWith", "name" to name), HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
                        HcChevron(if (open) ChevronDirection.Up else ChevronDirection.Down, color = HcColors.Black)
                    }
                    if (open) {
                        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            HcText(
                                if (isOwner) t.t("family.sharing.ownerNote", "name" to name) else t.t("family.sharing.grantNote", "name" to name, "owner" to family.ownerName),
                                HcTypeRoles.Caption,
                            )
                            Column {
                                SHARED_PROFILE_AREAS.forEach { area -> HcText("•  ${t.t("family.sharing.area.$area")}", HcTypeRoles.Body) }
                            }
                            HcText(t.t("family.sharing.canEdit", "name" to name), HcTypeRoles.Caption)
                        }
                    }
                    if (index < people.lastIndex) HcLine()
                }
            }
        }
    }
}

/** useConfirmSheet — message + "Fortsæt"; [word] makes it the typed variant (useTypedConfirmSheet). */
@Composable
internal fun ConfirmSheet(message: String, onConfirm: () -> Unit, onDismiss: () -> Unit, word: String? = null) {
    val t = LocalTranslator.current
    var typed by remember { mutableStateOf("") }
    HcBottomSheet(onDismiss = onDismiss) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HcText(message, HcTypeRoles.Body)
            if (word != null) CaptureFilledField(typed, { typed = it }, placeholder = word)
            HcButton(
                t.t("common.continue"),
                onClick = {
                    onConfirm()
                    onDismiss()
                },
                enabled = word == null || typed.trim().uppercase() == word.uppercase(),
            )
        }
    }
}

/**
 * src/components/family/InviteFamilyMemberSheet.tsx — name + e-mail and, per
 * profile, whether the person may see it / register for it. "Tilføj barn under
 * 18" creates a child profile in the sheet first.
 */
@Composable
internal fun InviteFamilyMemberSheet(status: FamilyStatus, onRefresh: suspend () -> Unit, onClose: () -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf("invite") }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var levels by remember { mutableStateOf(mapOf<String, String>()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val me = status.me
    val members = status.family?.members ?: listOf(FamilyMemberInfo(me.id, me.displayName))
    val canAddChild = members.size < (status.family?.capacity ?: status.maxProfiles)

    suspend fun addChild(input: FamilyProfileInput): Boolean {
        error = null
        busy = true
        val (ok, data) = familySend("/api/family/members", HttpMethod.Post, input.toBody() + ("isChild" to true))
        busy = false
        if (!ok) {
            error = familyErrorText(data, t)
            return false
        }
        ((data["profile"] as? JsonObject)?.get("id")?.jsonPrimitive?.contentOrNull)?.let { levels = levels + (it to "read") }
        onRefresh()
        step = "invite"
        return true
    }

    fun send() {
        error = null
        busy = true
        scope.launch {
            val subjectIds = levels.filterValues { it != "none" }.keys.toList()
            val writeSubjectIds = levels.filterValues { it == "write" }.keys.toList()
            val (ok, data) = familySend(
                "/api/family/invitations",
                HttpMethod.Post,
                mapOf("name" to name, "email" to email, "subjectIds" to subjectIds, "writeSubjectIds" to writeSubjectIds),
            )
            busy = false
            if (!ok) {
                error = familyErrorText(data, t)
                return@launch
            }
            onRefresh()
            step = "sent"
        }
    }

    val inviteFooter: @Composable ColumnScope.() -> Unit = {
        HcButton(t.t("family.invite.send"), onClick = ::send, enabled = !busy && name.isNotBlank() && email.isNotBlank())
        HcSheetSkipButton(t.t("common.cancel"))
    }
    val sentFooter: @Composable ColumnScope.() -> Unit = {
        val close = LocalHcSheetClose.current
        HcButton(t.t("family.invite.done"), onClick = close)
    }
    HcBottomSheet(
        onDismiss = onClose,
        title = t.t(if (step == "child") "family.invite.addChildTitle" else "family.invite.title"),
        size = HcSheetSize.Full,
        footer = when (step) {
            "invite" -> inviteFooter
            "sent" -> sentFooter
            else -> null
        },
    ) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (step) {
                "sent" -> {
                    HcText(t.t("family.invite.sent", "name" to name.trim(), "email" to email.trim()), HcTypeRoles.BodyLg)
                }
                "child" -> {
                    HcText(t.t("family.invite.addChildIntro"), HcTypeRoles.Body)
                    FamilyProfileForm(busy = busy, onSubmit = { addChild(it) }, onCancel = { step = "invite" }, childOnly = true)
                }
                else -> {
                    HcText(t.t("family.invite.intro"), HcTypeRoles.Body)
                    HcTextField(name, { name = it }, label = t.t("family.invite.name"), standard = true)
                    HcTextField(email, { email = it }, label = t.t("family.invite.email"), keyboardType = KeyboardType.Email, standard = true)
                    HcText(t.t("family.invite.insightTitle"), HcTypeRoles.CardTitle, Modifier.padding(top = 8.dp))
                    HcText(t.t("family.invite.insightHelp"), HcTypeRoles.Caption)
                    members.forEach { member ->
                        HcText(
                            when {
                                member.userId == me.id -> t.t("family.switcher.meLabel", "name" to member.displayName)
                                member.isChild -> "${member.displayName} · ${t.t("family.child")}"
                                else -> member.displayName
                            },
                            HcTypeRoles.Body,
                            bold = true,
                        )
                        AccessToggles(levels[member.userId] ?: "none", { levels = levels + (member.userId to it) }, enabled = !busy)
                    }
                    if (canAddChild) {
                        HcButton(
                            t.t("family.invite.addChild"),
                            onClick = {
                                error = null
                                step = "child"
                            },
                            kind = HcButtonKind.Secondary,
                            enabled = !busy,
                            leading = { HcIcon("Plus", size = 18.dp) },
                        )
                    }
                }
            }
            HcError(error)
        }
    }
}

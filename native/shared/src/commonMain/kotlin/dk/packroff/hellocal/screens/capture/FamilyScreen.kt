package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.ui.ProfileCircleTone
import dk.packroff.hellocal.ui.ProfileCircle
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.HcToggle
import io.ktor.http.HttpMethod
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

@Serializable
private data class PendingCode(
    val id: String,
    val profileId: String? = null,
    val email: String = "",
    val name: String? = null,
    val code: String = "",
    val expiresAt: String = "",
    val qrDataUrl: String = "",
)

private class Confirm(val message: String, val word: String? = null, val action: () -> Unit)

/** The QR code arrives as a data URL; decode it so the image loader gets plain bytes. */
@OptIn(ExperimentalEncodingApi::class)
private fun dataUrlBytes(dataUrl: String): ByteArray? =
    runCatching { Base64.decode(dataUrl.substringAfter("base64,")) }.getOrNull()

/** "8.10.2026" like toLocaleDateString("da-DK"). */
private fun shortDate(iso: String): String =
    CaptureDates.local(iso)?.date?.let { "${it.dayOfMonth}.${it.monthNumber}.${it.year}" } ?: iso

/**
 * Native port of src/app/profile/family/page.tsx (docs/FAMILY.md): the payer
 * creates profiles, marks children, makes login codes and decides who may see
 * and register for whom. An ordinary member sees who decides and can leave.
 */
@Composable
fun FamilyScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf<FamilyStatus?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var pendingCodes by remember { mutableStateOf<List<PendingCode>>(emptyList()) }
    var codeFormFor by remember { mutableStateOf<String?>(null) }
    var codeEmail by remember { mutableStateOf("") }
    var joinCode by remember { mutableStateOf("") }
    var joinEmail by remember { mutableStateOf("") }
    val addParam = args.opt("add")
    var addKind by remember { mutableStateOf(if (addParam == "child") "child" else if (addParam == "member" || addParam == "1") "member" else null) }
    var showInvite by remember { mutableStateOf(args.opt("invite") == "1") }
    var form by remember { mutableStateOf(FamilyProfileInput()) }
    var newAccess by remember { mutableStateOf(mapOf<String, Pair<String, String>>()) }
    var busy by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf<Confirm?>(null) }

    suspend fun refresh() {
        val (ok, data) = familySend("/api/family", HttpMethod.Get)
        if (ok) runCatching { ApiJson.decodeFromJsonElement(FamilyStatus.serializer(), data) }.getOrNull()?.let { status = it }
    }

    suspend fun loadCodes() {
        val (ok, data) = familySend("/api/family/codes", HttpMethod.Get)
        val codes = data["codes"]
        if (ok && codes != null) {
            runCatching { ApiJson.decodeFromJsonElement(ListSerializer(PendingCode.serializer()), codes) }.getOrNull()?.let { pendingCodes = it }
        }
    }

    LaunchedEffect(Unit) { refresh() }
    val isOwner = status?.family?.isOwner == true
    LaunchedEffect(isOwner) { if (isOwner) loadCodes() }

    suspend fun run(path: String, method: HttpMethod, body: Any? = null): Boolean {
        error = null
        busy = true
        val (ok, data) = familySend(path, method, body)
        busy = false
        if (!ok) error = familyErrorText(data, t)
        refresh()
        return ok
    }

    fun launchRun(path: String, method: HttpMethod, body: Any? = null, after: suspend (Boolean) -> Unit = {}) {
        scope.launch { after(run(path, method, body)) }
    }

    fun openCodeForm(key: String) {
        error = null
        codeEmail = ""
        codeFormFor = if (codeFormFor == key) null else key
    }

    HcScreen(title = t.t("family.title"), contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        val current = status
        if (current == null) {
            HcLoader()
            return@HcScreen
        }
        val family = current.family
        val members = family?.members.orEmpty()
        val nonOwners = members.filter { it.userId != family?.ownerId }
        val capacity = family?.capacity ?: current.maxProfiles
        fun grantLevel(granteeId: String, subjectId: String): String {
            val grant = family?.grants?.firstOrNull { it.granteeId == granteeId && it.subjectId == subjectId } ?: return "none"
            return if (grant.canWrite) "write" else "read"
        }
        fun memberName(userId: String) = members.firstOrNull { it.userId == userId }?.displayName ?: ""
        val newName = form.displayName.trim().ifEmpty { t.t("family.rights.newProfile") }

        // E-mail field + button that makes a code bound to the e-mail.
        @Composable
        fun CodeForm(key: String, profileId: String?) {
            if (codeFormFor != key) return
            HcCard {
                HcTextField(codeEmail, { codeEmail = it }, label = t.t("family.invite.emailLabel"), keyboardType = KeyboardType.Email, standard = true)
                HcText(t.t("family.invite.emailHelp"), HcTypeRoles.Caption)
                HcButton(
                    t.t("family.invite.submit"),
                    onClick = {
                        val body = buildMap<String, Any> {
                            put("email", codeEmail)
                            if (profileId != null) put("profileId", profileId)
                        }
                        launchRun("/api/family/codes", HttpMethod.Post, body) { ok ->
                            if (ok) {
                                codeFormFor = null
                                codeEmail = ""
                                loadCodes()
                            }
                        }
                    },
                    enabled = !busy && codeEmail.contains("@"),
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceSection)) {
            error?.let { HcText(it, HcTypeRoles.Body, color = HcColors.RedDark) }

            if (family == null) {
                Section(t.t("family.plan.title")) {
                    HcCard {
                        HcText(t.t("family.plan.intro", "max" to current.maxProfiles), HcTypeRoles.Body)
                        if (current.hasFamilyPlan) {
                            HcButton(t.t("family.invite.title"), onClick = { showInvite = true })
                            HcButton(t.t("family.add.addMember"), onClick = { addKind = "member" }, kind = HcButtonKind.Secondary)
                            HcButton(t.t("family.add.addChild"), onClick = { addKind = "child" }, kind = HcButtonKind.Secondary)
                        } else {
                            HcButton(t.t("family.plan.requiresPlan"), onClick = { nav.push("/profile/subscription") })
                        }
                    }
                }
                val kind = addKind
                if (current.hasFamilyPlan && kind != null) {
                    Section(t.t("family.add.title")) {
                        HcCard {
                            FamilyProfileForm(
                                busy = busy,
                                childOnly = kind == "child",
                                memberOnly = kind == "member",
                                onSubmit = { input ->
                                    val ok = run("/api/family/members", HttpMethod.Post, input.toBody() + ("access" to emptyList<Any>()))
                                    if (ok) addKind = null
                                    ok
                                },
                                onCancel = { addKind = null },
                            )
                        }
                    }
                }
                Section(t.t("family.join.title")) {
                    HcCard {
                        HcText(t.t("family.join.intro"), HcTypeRoles.Body)
                        HcText(t.t("family.join.scanHint"), HcTypeRoles.Caption)
                        HcTextField(joinCode, { joinCode = it.uppercase() }, label = t.t("family.join.codeLabel"), placeholder = "XXXX-XXXX", standard = true)
                        HcTextField(joinEmail, { joinEmail = it }, label = t.t("family.join.emailLabel"), keyboardType = KeyboardType.Email, standard = true)
                        HcButton(
                            t.t("family.join.submit"),
                            onClick = {
                                confirm = Confirm(t.t("family.join.confirm")) {
                                    launchRun("/api/family/join", HttpMethod.Post, mapOf("code" to joinCode, "email" to joinEmail)) { ok ->
                                        if (ok) {
                                            joinCode = ""
                                            joinEmail = ""
                                        }
                                    }
                                }
                            },
                            enabled = !busy && joinCode.trim().length >= 8 && joinEmail.contains("@"),
                        )
                    }
                }
            }

            if (family != null && !family.isOwner) {
                FamilySharingSection(family, current.me.id)
                Section(t.t("family.member.title")) {
                    HcCard {
                        HcText(t.t("family.member.intro", "owner" to family.ownerName), HcTypeRoles.Body)
                        HcText(t.t("family.member.seeLog"), HcTypeRoles.Body, Modifier.clickable { nav.push("/settings/control-log") }, underline = true)
                        if (current.meIsChild) {
                            HcText(t.t("family.member.childNote", "owner" to family.ownerName), HcTypeRoles.Caption)
                        } else {
                            HcButton(
                                t.t("family.member.leave"),
                                onClick = {
                                    confirm = Confirm(t.t("family.member.leaveConfirm", "owner" to family.ownerName)) {
                                        launchRun("/api/family/leave", HttpMethod.Post)
                                    }
                                },
                                kind = HcButtonKind.Secondary,
                                enabled = !busy,
                            )
                        }
                    }
                }
            }

            if (family != null && family.isOwner) {
                Section(t.t("family.seats.title")) {
                    HcCard {
                        HcText("${t.t("family.seats.membersCount", "count" to members.size, "max" to capacity)} ${t.t("family.seats.membersLabel")}", HcTypeRoles.Body)
                        HcText("${t.t("family.seats.extraCount", "count" to family.extraSeats, "max" to family.maxExtraSeats)} ${t.t("family.seats.extraLabel")}", HcTypeRoles.Body)
                    }
                }

                Section(t.t("family.members.title", "count" to members.size, "max" to capacity)) {
                    val shape = RoundedCornerShape(HcDimens.RadiusCard)
                    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                        members.forEachIndexed { index, member ->
                            val isPayer = member.userId == family.ownerId
                            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    ProfileCircle(member.displayName, tone = ProfileCircleTone.Card)
                                    Column(Modifier.weight(1f)) {
                                        HcText(if (isPayer) t.t("family.switcher.meLabel", "name" to member.displayName) else member.displayName, HcTypeRoles.Body, maxLines = 1)
                                        val role = when {
                                            isPayer -> t.t("family.members.payer")
                                            member.hasLogin -> t.t("family.members.hasLogin")
                                            else -> t.t("family.members.noLogin")
                                        }
                                        HcText(role + (member.age?.let { " · ${t.t("family.members.age", "age" to it)}" } ?: ""), HcTypeRoles.Caption)
                                    }
                                }
                                if (!isPayer) {
                                    HcToggle(
                                        checked = member.isChild,
                                        onChange = { value -> launchRun("/api/family/members/${member.userId}", HttpMethod.Patch, mapOf("isChild" to value)) },
                                        label = t.t("family.members.isChild"),
                                        enabled = !busy,
                                    )
                                    if (!member.hasLogin) {
                                        HcButton(t.t("family.members.createLoginCode"), onClick = { openCodeForm(member.userId) }, kind = HcButtonKind.Secondary, enabled = !busy)
                                    }
                                    CodeForm(member.userId, member.userId)
                                    if (!member.hasLogin) {
                                        TextAction(t.t("family.members.deleteProfile"), danger = true, enabled = !busy) {
                                            confirm = Confirm(t.t("family.members.deleteProfileConfirm", "name" to member.displayName), "SLET") {
                                                launchRun("/api/family/members/${member.userId}?deleteProfile=1", HttpMethod.Delete, mapOf("confirm" to "SLET"))
                                            }
                                        }
                                    } else {
                                        TextAction(t.t("family.members.remove"), enabled = !busy) {
                                            confirm = Confirm(t.t("family.members.removeConfirm", "name" to member.displayName)) {
                                                launchRun("/api/family/members/${member.userId}", HttpMethod.Delete)
                                            }
                                        }
                                    }
                                }
                            }
                            if (index < members.lastIndex) HcLine()
                        }
                    }
                }

                if (pendingCodes.isNotEmpty()) {
                    Section(t.t("family.pending.title")) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            pendingCodes.forEach { pending ->
                                val date = shortDate(pending.expiresAt)
                                HcCard {
                                    HcText(
                                        when {
                                            pending.profileId != null -> t.t("family.pending.claimTitle", "name" to memberName(pending.profileId), "email" to pending.email)
                                            pending.name != null -> t.t("family.pending.inviteTitle", "name" to pending.name, "email" to pending.email)
                                            else -> t.t("family.pending.joinTitle", "email" to pending.email)
                                        },
                                        HcTypeRoles.CardTitle,
                                    )
                                    // The QR code is a link with the code and e-mail encrypted (src/lib/family-invite-token.ts).
                                    dataUrlBytes(pending.qrDataUrl)?.let { bytes ->
                                        AsyncImage(
                                            model = bytes,
                                            contentDescription = t.t("family.pending.qrAlt", "email" to pending.email),
                                            modifier = Modifier.align(Alignment.CenterHorizontally).size(240.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.White),
                                        )
                                    }
                                    HcText(pending.code, HcTypeRoles.BodyLg, Modifier.fillMaxWidth(), bold = true, align = TextAlign.Center)
                                    HcText(
                                        if (pending.profileId != null) t.t("family.pending.claimHelp", "name" to memberName(pending.profileId), "email" to pending.email, "date" to date)
                                        else t.t("family.pending.joinHelp", "email" to pending.email, "date" to date),
                                        HcTypeRoles.Caption,
                                    )
                                    TextAction(t.t("family.pending.revoke"), enabled = !busy) {
                                        confirm = Confirm(t.t("family.pending.revokeConfirm", "email" to pending.email)) {
                                            launchRun("/api/family/codes/${pending.id}", HttpMethod.Delete) { loadCodes() }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (members.size < capacity) {
                    Section(t.t("family.add.title")) {
                        val kind = addKind
                        if (kind == null) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                HcButton(t.t("family.invite.title"), onClick = { showInvite = true })
                                HcButton(t.t("family.add.addMember"), onClick = { addKind = "member" }, kind = HcButtonKind.Secondary)
                                HcButton(t.t("family.add.addChild"), onClick = { addKind = "child" }, kind = HcButtonKind.Secondary)
                            }
                        } else {
                            HcCard {
                                HcText(t.t(if (kind == "child") "family.add.addChild" else "family.add.addMember"), HcTypeRoles.CardTitle)
                                if (kind == "child") HcText(t.t("family.add.isChildHelp"), HcTypeRoles.Caption)
                                FamilyProfileFields(form) { form = it }
                                if (nonOwners.isNotEmpty()) {
                                    HcText(t.t("family.rights.title"), HcTypeRoles.CardTitle)
                                    HcText(t.t("family.rights.intro"), HcTypeRoles.Caption)
                                    nonOwners.forEach { person ->
                                        val levels = newAccess[person.userId] ?: ("none" to "none")
                                        HcText(t.t("family.rights.personOn", "person" to person.displayName, "profile" to newName), HcTypeRoles.Body, bold = true)
                                        AccessToggles(levels.first, { newAccess = newAccess + (person.userId to (it to levels.second)) })
                                        HcText(t.t("family.rights.personOn", "person" to newName, "profile" to person.displayName), HcTypeRoles.Body, bold = true)
                                        AccessToggles(levels.second, { newAccess = newAccess + (person.userId to (levels.first to it)) })
                                    }
                                }
                                HcButton(
                                    t.t(if (kind == "child") "family.add.addChild" else "family.add.addMember"),
                                    onClick = {
                                        val access = newAccess.map { (personId, levels) -> mapOf("personId" to personId, "personOnNew" to levels.first, "newOnPerson" to levels.second) }
                                        val body = form.toBody() + mapOf("isChild" to (kind == "child"), "access" to access)
                                        launchRun("/api/family/members", HttpMethod.Post, body) { ok ->
                                            if (ok) {
                                                form = FamilyProfileInput()
                                                newAccess = emptyMap()
                                                addKind = null
                                            }
                                        }
                                    },
                                    enabled = !busy && form.displayName.isNotBlank(),
                                )
                                HcButton(t.t("common.cancel"), onClick = { addKind = null }, kind = HcButtonKind.Text)
                            }
                        }
                    }
                }

                if (nonOwners.size > 1) {
                    Section(t.t("family.access.title")) {
                        HcText(t.t("family.access.intro"), HcTypeRoles.Body)
                        nonOwners.forEach { subject ->
                            HcCard(Modifier.padding(top = 8.dp)) {
                                HcText(t.t("family.access.who", "name" to subject.displayName), HcTypeRoles.CardTitle)
                                nonOwners.filter { it.userId != subject.userId }.forEach { grantee ->
                                    HcText(grantee.displayName, HcTypeRoles.Body, bold = true)
                                    AccessToggles(
                                        grantLevel(grantee.userId, subject.userId),
                                        { level ->
                                            launchRun("/api/family/grants", HttpMethod.Put, mapOf("granteeId" to grantee.userId, "subjectId" to subject.userId, "level" to level))
                                        },
                                        enabled = !busy,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    confirm?.let { c -> ConfirmSheet(c.message, onConfirm = c.action, onDismiss = { confirm = null }, word = c.word) }

    val currentStatus = status
    if (showInvite && currentStatus != null) {
        InviteFamilyMemberSheet(currentStatus, onRefresh = { refresh() }, onClose = {
            showInvite = false
            scope.launch { loadCodes() }
        })
    }
}

/** A section with the shared section title (.hf-type-section-title). */
@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
        HcSectionTitle(title)
        content()
    }
}

/** .hf-btn-text — bold underlined text button (red for destructive actions). */
@Composable
private fun TextAction(label: String, danger: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    HcText(
        label,
        HcTypeRoles.Body,
        Modifier.clickable(enabled = enabled, onClick = onClick).padding(vertical = 4.dp),
        bold = true,
        underline = true,
        color = if (danger) HcColors.RedDark else HcColors.Action,
    )
}

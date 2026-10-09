package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.HeightUnit
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileBathScaleIcon
import dk.packroff.hellocal.ui.ProfileCenteredText
import dk.packroff.hellocal.ui.ProfileDateWheelSheet
import dk.packroff.hellocal.ui.ProfileFieldLabel
import dk.packroff.hellocal.ui.ProfileFilledField
import dk.packroff.hellocal.ui.ProfileIcon
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfilePartyPopperIcon
import dk.packroff.hellocal.ui.ProfileShortMonths
import dk.packroff.hellocal.ui.ProfileValueButton
import dk.packroff.hellocal.ui.ProfileVectorIcon
import dk.packroff.hellocal.ui.ProfileWaistMeasureIcon
import dk.packroff.hellocal.ui.ProfileWheelPicker
import dk.packroff.hellocal.ui.icons.HcIcon
import dk.packroff.hellocal.ui.profileDaysInMonth
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private val ACTIVITY_LEVELS = listOf("VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH")

/** Nobody logs calories from birth: the latest pickable birth date is 10 years before today. */
const val BIRTH_DATE_MIN_AGE_YEARS = 10

/** Native port of src/app/profile/edit/page.tsx. */
@Composable
fun ProfileEditScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val units = remember { Units.current() }
    val debouncer = remember { ProfileDebouncer(scope) }
    var user by remember { mutableStateOf<ProfileUser?>(null) }
    var loading by remember { mutableStateOf(true) }
    var trendWeightKg by remember { mutableStateOf<Double?>(null) }
    var energySummary by remember { mutableStateOf<EnergySummary?>(null) }
    // Phone (docs/DECISIONS.md 2026-10-02): required, can be corrected but not deleted.
    var phoneDraft by remember { mutableStateOf<String?>(null) }
    var phoneError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        user = runCatching { ProfileApi.loadUser() }.getOrNull()
        loading = false
    }
    LaunchedEffect(Unit) {
        trendWeightKg = runCatching { ProfileWeights.latestTrendWeight(ProfileWeights.entries(), ProfileWeights.mealTimes()) }.getOrNull()
    }
    // The calculation is fetched again whenever weight, height, age, sex or level change.
    val energyVersion = user?.let { listOf(it.weightKg, it.heightCm, it.birthDate, it.sex, it.activityLevel).joinToString("|") }
    LaunchedEffect(energyVersion) {
        if (energyVersion == null) return@LaunchedEffect
        runCatching { ProfileApi.loadEnergySummary() }.getOrNull()?.let { energySummary = it }
    }

    fun update(key: String, value: Any?, apply: (ProfileUser) -> ProfileUser) {
        user = user?.let(apply)
        debouncer.run { ProfileApi.patch(mapOf(key to value)) }
    }

    fun updateNow(key: String, value: Any?, apply: (ProfileUser) -> ProfileUser) {
        user = user?.let(apply)
        scope.launch { runCatching { ProfileApi.patch(mapOf(key to value)) } }
    }

    fun commitPhone() {
        val current = user ?: return
        val draft = phoneDraft ?: return
        when (val parsed = ProfilePhone.validate(draft, current.region)) {
            is ProfilePhone.Result.Invalid -> phoneError = t.t(if (parsed.empty) "profile.phoneRequired" else "profile.phoneInvalid")
            is ProfilePhone.Result.Ok -> {
                phoneError = null
                phoneDraft = null
                if (parsed.e164 != current.phone) updateNow("phone", parsed.e164) { it.copy(phone = parsed.e164) }
            }
        }
    }

    HcScreen(
        title = t.t("profile.section.profile"),
        contentPadding = ProfilePagePadding,
        bottom = if (user != null) {
            {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    val pill = RoundedCornerShape(50)
                    Box(
                        Modifier.fillMaxWidth().height(48.dp).clip(pill).border(1.dp, HcColors.GrayBorder, pill)
                            .clickable { nav.push("/profile/login-approval") }.padding(horizontal = 16.dp),
                        contentAlignment = Alignment.Center,
                    ) { HcText(t.t("loginApproval.toggle"), HcTypeRoles.Body, align = TextAlign.Center) }
                    HcButton(t.t("profile.changePasswordButton"), onClick = { nav.push("/profile/change-password") })
                }
            }
        } else {
            null
        },
    ) {
        val current = user
        when {
            loading -> HcLoader()
            current == null -> ProfileCenteredText(t.t("profile.loadError"))
            else -> ProfilePage {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ProfileFieldLabel(t.t("profile.field.name"))
                    ProfileFilledField(current.displayName, { value -> update("displayName", value) { it.copy(displayName = value) } }, Modifier.fillMaxWidth())
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ProfileFieldLabel(t.t("profile.field.email"))
                    ProfileFilledField(current.email, {}, Modifier.fillMaxWidth(), enabled = false)
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ProfileFieldLabel(t.t("profile.field.phone"))
                    ProfileFilledField(
                        phoneDraft ?: ProfilePhone.format(current.phone),
                        {
                            phoneDraft = it
                            phoneError = null
                        },
                        Modifier.fillMaxWidth(),
                        keyboardType = KeyboardType.Phone,
                        onCommit = ::commitPhone,
                    )
                    HcText(phoneError ?: t.t("profile.phoneHint"), HcTypeRoles.Micro, color = if (phoneError != null) HcColors.RedDark else HcColors.TextSecondary)
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    // Always locked (docs/DECISIONS.md 2026-09-25): a tap opens the "lock" page.
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFieldLabel(t.t("profile.field.weight"))
                        ProfileValueButton(
                            text = (current.weightKg?.let { Units.formatWeight(it, units.weight) } ?: Units.weightUnitLabel(units.weight)).uppercase(),
                            onClick = { nav.push("/profile/start-weight") },
                            dimmed = true,
                            leading = { HcIcon("Lock", size = 18.dp, color = HcColors.Black) },
                        )
                        trendWeightKg?.let {
                            HcText(t.t("profile.trendWeight", "value" to Units.formatWeight(it, units.weight)), HcTypeRoles.Micro, color = HcColors.TextSecondary)
                        }
                        if (current.weightKg != null) {
                            HcText(
                                t.t("profile.startWeightUpdated", "date" to ProfileDates.dayMonthYear(current.startWeightUpdatedAt ?: current.createdAt)),
                                HcTypeRoles.Micro,
                                color = HcColors.TextSecondary,
                            )
                        }
                    }
                    // Locked like the weight (docs/DECISIONS.md 2026-10-03): can only be picked while empty.
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFieldLabel(t.t("profile.field.height"))
                        val heightCm = current.heightCm
                        if (heightCm != null) {
                            ProfileValueButton(
                                text = Units.formatLength(heightCm, units.height).uppercase(),
                                onClick = { nav.push("/profile/height") },
                                dimmed = true,
                                leading = { HcIcon("Lock", size = 18.dp, color = HcColors.Black) },
                            )
                        } else {
                            val inches = units.height == HeightUnit.In
                            ProfileWheelPicker(
                                label = t.t("profile.field.height"),
                                value = null,
                                min = if (inches) 39 else 100,
                                max = if (inches) 91 else 230,
                                unit = units.height.code.uppercase(),
                                initialScrollValue = if (inches) 69 else 175,
                                onChange = { value ->
                                    val cm = if (inches) Units.inToCm(value.toDouble()).roundToInt().toDouble() else value.toDouble()
                                    updateNow("heightCm", cm) { it.copy(heightCm = cm) }
                                },
                            )
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFieldLabel(t.t("profile.field.birthDate"))
                        ProfileBirthDatePicker(t.t("profile.field.birthDate"), current.birthDate) { value ->
                            updateNow("birthDate", value) { it.copy(birthDate = value) }
                        }
                        val age = ProfileDates.age(current.birthDate)
                        if (age != null && age >= BIRTH_DATE_MIN_AGE_YEARS) {
                            HcText(t.t("profile.age", "age" to age), HcTypeRoles.Micro, color = HcColors.TextSecondary)
                        }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFieldLabel(t.t("profile.field.sex"))
                        SexSelect(current.sex) { value -> updateNow("sex", value) { it.copy(sex = value) } }
                    }
                }

                ActivityLevelPicker(current.activityLevel) { level -> updateNow("activityLevel", level) { it.copy(activityLevel = level) } }

                energySummary?.let { ProfileEnergyBreakdown(it) }

                // Four equal square shortcuts (1:1) — the text never makes a box bigger.
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ShortcutTile(t.t("profile.actions.photoDiary"), { nav.push("/profile/photo-diary") }) { ProfileIcon(ProfileVectorIcon.PhotoFrame, 34.dp, stroke = 1.6f) }
                    ShortcutTile(t.t("profile.actions.newWeight"), { nav.push("/profile/weight-calibration") }) { ProfileBathScaleIcon(34.dp) }
                    ShortcutTile(t.t("profile.actions.target"), { nav.push("/profile/goals") }) { ProfilePartyPopperIcon(34.dp) }
                    ShortcutTile(t.t("profile.actions.bodyMeasurements"), { nav.push("/profile/body-measurements") }) { ProfileWaistMeasureIcon(current.sex, 34.dp) }
                }

                Box(Modifier.padding(top = 16.dp)) { ProfileFaceIdButton() }

                ProfileAccountDeletionSection()
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.ShortcutTile(label: String, onClick: () -> Unit, icon: @Composable () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier.weight(1f).aspectRatio(1f).clip(shape).background(HcColors.Tan, shape).clickable(onClick = onClick).padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
    ) {
        icon()
        HcText(label, HcTypeRoles.Small, bold = true, color = HcColors.Black, align = TextAlign.Center, maxLines = 2)
    }
}

/** Five bars of rising height; the chosen step and those below it are black (src/lib/activity-level.ts). */
@Composable
private fun ActivityLevelPicker(value: String?, onChange: (String) -> Unit) {
    val t = LocalTranslator.current
    val selectedIndex = if (value != null) ACTIVITY_LEVELS.indexOf(value) else -1
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ProfileFieldLabel(t.t("profile.field.activityLevel"))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ACTIVITY_LEVELS.forEachIndexed { index, level ->
                val shape = RoundedCornerShape(12.dp)
                Box(
                    Modifier.weight(1f).height(64.dp).clip(shape).background(HcColors.Tan, shape).clickable { onChange(level) }
                        .padding(start = 8.dp, end = 8.dp, bottom = 8.dp),
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    Box(
                        Modifier.fillMaxWidth().height((8 + index * 8).dp).clip(RoundedCornerShape(4.dp))
                            .background(if (index <= selectedIndex) HcColors.Black else HcColors.Black.copy(alpha = 0.15f)),
                    )
                }
            }
        }
        if (value != null) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(t.t("profile.activityLevel.$value.label"), HcTypeRoles.Body, bold = true)
                HcText("${t.t("profile.activityLevel.$value.description")} ${t.t("profile.activityLevel.note")}", HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
        } else {
            HcText(t.t("profile.activityLevel.notSet"), HcTypeRoles.Small, color = HcColors.TextSecondary)
        }
    }
}

/** The web's <select> for sex: unspecified / female / male. */
@Composable
private fun SexSelect(value: String?, onChange: (String?) -> Unit) {
    val t = LocalTranslator.current
    var open by remember { mutableStateOf(false) }
    val options = listOf(null to t.t("profile.sexOption.unspecified"), "FEMALE" to t.t("profile.sexOption.female"), "MALE" to t.t("profile.sexOption.male"))
    ProfileValueButton(
        text = options.firstOrNull { it.first == value }?.second ?: options.first().second,
        onClick = { open = true },
    )
    if (open) {
        HcBottomSheet(onDismiss = { open = false }, title = t.t("profile.field.sex")) {
            options.forEach { (key, label) ->
                Row(
                    Modifier.fillMaxWidth().height(48.dp).clickable {
                        open = false
                        if (key != value) onChange(key)
                    },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HcText(label, HcTypeRoles.BodyLg, Modifier.weight(1f))
                    if (key == value) HcIcon("Check", size = 20.dp, color = HcColors.Black)
                }
            }
        }
    }
}

/**
 * src/components/ui/BirthDatePicker.tsx — opens on the saved date, or on
 * 1 Jan 1990 when none is saved, and only commits on "Færdig".
 */
@Composable
fun ProfileBirthDatePicker(label: String, value: String?, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val today = ProfileDates.today()
    val latestYear = today.year - BIRTH_DATE_MIN_AGE_YEARS
    val latest = Triple(latestYear, today.monthNumber, minOf(today.dayOfMonth, profileDaysInMonth(latestYear, today.monthNumber)))
    fun key(d: Triple<Int, Int, Int>) = d.first * 10000 + d.second * 100 + d.third
    val parsed = ProfileDates.parseDay(value)?.let { Triple(it.year, it.monthNumber, it.dayOfMonth) }
    val saved = parsed?.takeIf { key(it) <= key(latest) }
    ProfileValueButton(
        text = saved?.let { "${it.third}. ${ProfileShortMonths[it.second - 1]} ${it.first}" } ?: "Vælg",
        onClick = { open = true },
    )
    if (open) {
        ProfileDateWheelSheet(
            label = label,
            initial = saved ?: Triple(1990, 1, 1),
            minDate = Triple(1900, 1, 1),
            maxDate = latest,
            onDismiss = { open = false },
            onDone = { picked ->
                onChange("${picked.first}-${picked.second.toString().padStart(2, '0')}-${picked.third.toString().padStart(2, '0')}")
            },
        )
    }
}

/** src/components/FaceIdButton.tsx — only shown when the device has Face ID/Touch ID. */
@Composable
private fun ProfileFaceIdButton() {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var state by remember {
        mutableStateOf(
            when {
                !ProfileNativeBridge.biometricAvailable() -> "hidden"
                ProfileNativeBridge.biometricEnabledOnDevice() -> "done"
                else -> "offer"
            },
        )
    }
    if (state == "hidden") return
    val done = state == "done"
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val shape = RoundedCornerShape(12.dp)
        Row(
            Modifier.fillMaxWidth().height(48.dp).clip(shape).background(HcColors.Tan, shape)
                .clickable(enabled = !done && state != "busy") {
                    state = "busy"
                    scope.launch {
                        state = if (runCatching { ProfileNativeBridge.enableBiometricLogin() }.getOrDefault(false)) "done" else "error"
                    }
                }.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
        ) {
            ProfileIcon(ProfileVectorIcon.FaceId, 30.dp, color = HcColors.Faceid)
            HcText(
                when {
                    done -> t.t("faceIdOffer.active")
                    state == "busy" -> t.t("faceIdOffer.enabling")
                    else -> t.t("faceIdOffer.activate")
                },
                HcTypeRoles.Body,
                bold = true,
                color = HcColors.Black,
            )
        }
        if (state == "error") HcText(t.t("faceIdOffer.error"), HcTypeRoles.Caption, color = HcColors.RedDark)
    }
}

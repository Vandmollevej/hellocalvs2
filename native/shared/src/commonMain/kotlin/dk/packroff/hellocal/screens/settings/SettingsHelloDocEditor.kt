package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import dk.packroff.hellocal.screens.food.FoodProfile
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.ui.CaptureDatePickerSheet
import dk.packroff.hellocal.ui.CaptureDates
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.plus
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.VSpace
import dk.packroff.hellocal.ui.icons.HcIcon

/**
 * Native port of src/components/hf/DoctorShareEditor.tsx — the shared body of
 * "Inviter bruger" and the already-invited-user edit screen (the user asked for
 * the two screens to be "almost identical").
 */
@Composable
fun SettingsHelloDocEditor(
    name: String,
    onNameChange: (String) -> Unit,
    email: String,
    onEmailChange: (String) -> Unit,
    categories: List<String>,
    onCategoriesChange: (List<String>) -> Unit,
    historyRange: String,
    onHistoryRangeChange: (String) -> Unit,
    /** "YYYY-MM-DD" from the date picker; "" = no expiry. */
    expiresAt: String,
    onExpiresAtChange: (String) -> Unit,
    onPreview: () -> Unit,
) {
    val t = LocalTranslator.current

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceSection)) {
        Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
            HcTextField(
                value = name,
                onValueChange = onNameChange,
                label = t.t("helloDoc.nameLabel"),
                placeholder = t.t("helloDoc.namePlaceholder"),
                standard = true,
            )
            HcTextField(
                value = email,
                onValueChange = onEmailChange,
                label = t.t("helloDoc.emailLabel"),
                placeholder = t.t("helloDoc.emailPlaceholder"),
                keyboardType = KeyboardType.Email,
                standard = true,
            )
        }

        // hf-btn-secondary on a white background.
        HcButton(
            label = t.t("helloDoc.previewButton"),
            onClick = onPreview,
            modifier = Modifier.background(HcColors.White, RoundedCornerShape(HcDimens.RadiusCard)),
            kind = HcButtonKind.Secondary,
        )

        Column(Modifier.fillMaxWidth()) {
            HcSectionTitle(t.t("helloDoc.shareDataTitle"))
            VSpace(HcDimens.SpaceBlock)
            Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline)) {
                // Menstruation is only for women — not shown at all for men.
                LaunchedEffect(Unit) { if (FoodProfile.user == null) FoodProfile.refresh() }
                val isFemale = FoodProfile.user?.sex == "FEMALE"
                for (category in SettingsHelloDoc.Categories.filter { it != "menstrualCycle" || isFemale }) {
                    val unavailable = category in SettingsHelloDoc.UnavailableCategories
                    HcToggle(
                        checked = !unavailable && category in categories,
                        onChange = { checked ->
                            onCategoriesChange(if (checked) categories + category else categories.filter { it != category })
                        },
                        label = t.t(SettingsHelloDoc.categoryLabelKey(category)),
                        description = if (unavailable) t.t(SettingsHelloDoc.UnavailableLabelKey[category] ?: "helloDoc.categoryUnavailable") else null,
                        enabled = !unavailable,
                    )
                }
            }
        }

        Column(Modifier.fillMaxWidth()) {
            HcSectionTitle(t.t("helloDoc.historyTitle"))
            VSpace(HcDimens.SpaceBlock)
            SettingsHelloDocRangeSelect(
                value = historyRange,
                onChange = onHistoryRangeChange,
                sheetTitle = t.t("helloDoc.historyTitle"),
            )
        }

        Column(Modifier.fillMaxWidth()) {
            HcSectionTitle(t.t("helloDoc.expiryTitle"))
            VSpace(HcDimens.SpaceBlock)
            val tomorrow = remember { CaptureDates.today().plus(1, DateTimeUnit.DAY) }
            var picking by remember { mutableStateOf(false) }
            HcToggle(
                checked = expiresAt.isEmpty(),
                onChange = { none -> onExpiresAtChange(if (none) "" else CaptureDates.isoDate(tomorrow)) },
                label = t.t("helloDoc.expiryNone"),
            )
            if (expiresAt.isNotEmpty()) {
                VSpace(HcDimens.SpaceInline)
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Box(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = HcDimens.ControlHeight)
                        .clip(shape)
                        .background(HcColors.Cream, shape)
                        .border(1.dp, HcColors.FieldBorder, shape)
                        .clickable { picking = true },
                    contentAlignment = Alignment.CenterStart,
                ) {
                    HcText(expiresAt, HcTypeRoles.Input, Modifier.padding(horizontal = 16.dp), maxLines = 1)
                }
            }
            VSpace(HcDimens.SpaceInline)
            HcText(t.t("helloDoc.expiryHint"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
            if (picking) {
                CaptureDatePickerSheet(
                    initial = CaptureDates.parseDate(expiresAt) ?: tomorrow,
                    min = tomorrow,
                    onPick = { onExpiresAtChange(CaptureDates.isoDate(it)) },
                    onDismiss = { picking = false },
                    title = t.t("helloDoc.expiryDateAria"),
                )
            }
        }
    }
}

/**
 * The web's `<select class="hf-field …">` over the history ranges (cream field,
 * field-border, chevron right). Native: tapping opens a bottom sheet with the
 * options, the selected one ticked. `compact` = the preview's narrower variant
 * (pl-3 pr-9, 16 px chevron).
 */
@Composable
fun SettingsHelloDocRangeSelect(
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    sheetTitle: String? = null,
) {
    val t = LocalTranslator.current
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(HcDimens.RadiusCard)

    Box(
        modifier
            .fillMaxWidth()
            .heightIn(min = HcDimens.ControlHeight)
            .clip(shape)
            .background(HcColors.Cream, shape)
            .border(1.dp, HcColors.FieldBorder, shape)
            .clickable { open = true },
        contentAlignment = Alignment.CenterStart,
    ) {
        HcText(
            t.t(SettingsHelloDoc.historyLabelKey(value)),
            HcTypeRoles.Input,
            Modifier.padding(start = if (compact) 12.dp else 16.dp, end = if (compact) 36.dp else 40.dp),
            maxLines = 1,
        )
        HcIcon(
            "ChevronDown",
            Modifier.align(Alignment.CenterEnd).padding(end = if (compact) 10.dp else 12.dp),
            size = if (compact) 16.dp else 18.dp,
            color = HcColors.Black,
            stroke = 2.5f,
        )
    }

    if (open) {
        HcBottomSheet(onDismiss = { open = false }, title = sheetTitle) {
            for (range in SettingsHelloDoc.HistoryRanges) {
                val selected = range == value
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = HcDimens.ControlHeight)
                        .clickable {
                            open = false
                            if (!selected) onChange(range)
                        }
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
                ) {
                    HcText(t.t(SettingsHelloDoc.historyLabelKey(range)), HcTypeRoles.Input, Modifier.weight(1f), bold = selected)
                    if (selected) HcIcon("Check", size = 20.dp, color = HcColors.Brand)
                }
            }
        }
    }
}

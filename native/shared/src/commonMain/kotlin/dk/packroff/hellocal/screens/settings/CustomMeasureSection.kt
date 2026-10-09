package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.screens.food.CUSTOM_MEASURE_MAX_LINES
import dk.packroff.hellocal.screens.food.CUSTOM_MEASURE_MAX_LINE_LENGTH
import dk.packroff.hellocal.screens.food.CustomMeasurePrefs
import dk.packroff.hellocal.screens.food.CustomMeasurement
import dk.packroff.hellocal.screens.food.MEASURE_PARAMS
import dk.packroff.hellocal.screens.food.MEASURE_PARAM_BY_KEY
import dk.packroff.hellocal.screens.food.MEASURE_PERIOD_KEYS
import dk.packroff.hellocal.screens.food.MeasureGroup
import dk.packroff.hellocal.screens.food.clampMeasureText
import dk.packroff.hellocal.screens.food.newMeasurementId
import dk.packroff.hellocal.screens.food.suggestMeasureText
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.SettingsDropdown
import dk.packroff.hellocal.ui.SettingsNamedIcon
import dk.packroff.hellocal.ui.SettingsOption

/**
 * Native port of src/components/CustomMeasureSection.tsx: "Tilføj egen måling"
 * at the top of Settings → Visning → Forside. Name and description, parameter
 * (searchable list), period and a short text (at most 2 lines of 15 characters)
 * under the number in the front page wheel.
 */
@Composable
fun CustomMeasureSection() {
    val t = LocalTranslator.current
    val measurements = CustomMeasurePrefs.measurements
    var editing by remember { mutableStateOf<CustomMeasurement?>(null) }
    var adding by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcButton(t.t("customMeasure.add"), onClick = { adding = true }, kind = HcButtonKind.Primary)
        if (measurements.isNotEmpty()) {
            val shape = RoundedCornerShape(16.dp)
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                measurements.forEachIndexed { index, m ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        SettingsNamedIcon("Ruler2", 20.dp)
                        Column(Modifier.weight(1f).clickable { editing = m }) {
                            HcText(m.name, HcTypeRoles.Body, color = HcColors.Black, maxLines = 1)
                            HcText(
                                "${t.t(MEASURE_PARAM_BY_KEY[m.param]?.labelKey ?: "")} · ${t.t("customMeasure.period.${m.period}")}",
                                HcTypeRoles.Small,
                                color = HcColors.TextSecondary,
                                maxLines = 1,
                            )
                        }
                        HcText(
                            t.t("customMeasure.delete"),
                            HcTypeRoles.Small,
                            Modifier.clickable { CustomMeasurePrefs.save(measurements.filter { it.id != m.id }) },
                            color = HcColors.TextSecondary,
                            bold = true,
                        )
                    }
                    if (index < measurements.size - 1) HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
                }
            }
        }
    }

    if (adding || editing != null) {
        val initial = editing
        MeasureSheet(
            initial = initial,
            onDismiss = {
                adding = false
                editing = null
            },
            onSave = { measurement ->
                val exists = measurements.any { it.id == measurement.id }
                CustomMeasurePrefs.save(if (exists) measurements.map { if (it.id == measurement.id) measurement else it } else measurements + measurement)
            },
        )
    }
}

@Composable
private fun MeasureSheet(initial: CustomMeasurement?, onDismiss: () -> Unit, onSave: (CustomMeasurement) -> Unit) {
    val t = LocalTranslator.current
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var description by remember { mutableStateOf(initial?.description ?: "") }
    var param by remember { mutableStateOf(initial?.param ?: "") }
    var period by remember { mutableStateOf(initial?.period ?: "today") }
    var text by remember { mutableStateOf(initial?.text ?: "") }
    // The text follows the suggestion until the user edits it.
    var textEdited by remember { mutableStateOf(!initial?.text.isNullOrEmpty()) }
    var pickerOpen by remember { mutableStateOf(initial == null) }
    var query by remember { mutableStateOf("") }

    val valid = name.isNotBlank() && param in MEASURE_PARAM_BY_KEY

    HcBottomSheet(
        onDismiss = onDismiss,
        title = t.t("customMeasure.add"),
        size = HcSheetSize.Full,
        scrollable = true,
        footer = {
            val close = LocalHcSheetClose.current
            HcButton(
                t.t("customMeasure.save"),
                onClick = {
                    onSave(
                        CustomMeasurement(
                            id = initial?.id ?: newMeasurementId(),
                            name = name.trim(),
                            description = description.trim(),
                            param = param,
                            period = period,
                            text = clampMeasureText(text),
                        ),
                    )
                    close()
                },
                enabled = valid,
            )
            HcButton(t.t("customMeasure.cancel"), onClick = close, kind = HcButtonKind.Secondary)
        },
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            HcTextField(name, { name = it.take(40) }, label = t.t("customMeasure.nameLabel"), standard = true)
            HcTextField(description, { description = it.take(200) }, label = t.t("customMeasure.descriptionLabel"), standard = true, singleLine = false)

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(t.t("customMeasure.paramLabel"), HcTypeRoles.Label)
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Row(
                    Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.Page, shape)
                        .border(1.dp, HcColors.FieldBorder, shape).clickable { pickerOpen = !pickerOpen }.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HcText(
                        if (param.isNotEmpty()) t.t(MEASURE_PARAM_BY_KEY.getValue(param).labelKey) else t.t("customMeasure.paramPlaceholder"),
                        HcTypeRoles.Input,
                        color = if (param.isNotEmpty()) HcColors.Black else HcColors.Placeholder,
                    )
                }
                if (pickerOpen) {
                    HcTextField(query, { query = it }, placeholder = t.t("customMeasure.search"), standard = true)
                    val needle = query.trim().lowercase()
                    val options = MEASURE_PARAMS.map { it to t.t(it.labelKey) }.filter { (_, label) -> needle.isEmpty() || label.lowercase().contains(needle) }
                    if (options.isEmpty()) {
                        HcText(t.t("customMeasure.noMatch"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    }
                    LazyColumn(Modifier.heightIn(max = 256.dp).fillMaxWidth().clip(shape).background(HcColors.Page, shape).border(1.dp, HcColors.FieldBorder, shape)) {
                        MeasureGroup.entries.forEach { group ->
                            val inGroup = options.filter { (def, _) -> def.group == group }
                            if (inGroup.isNotEmpty()) {
                                item(key = "group-${group.key}") {
                                    HcText(
                                        t.t("customMeasure.group.${group.key}"),
                                        HcTypeRoles.Small,
                                        Modifier.fillMaxWidth().background(HcColors.Tan).padding(horizontal = 16.dp, vertical = 4.dp),
                                        color = HcColors.TextSecondary,
                                        bold = true,
                                    )
                                }
                                inGroup.forEach { (def, label) ->
                                    item(key = def.key) {
                                        HcText(
                                            label,
                                            HcTypeRoles.Body,
                                            Modifier.fillMaxWidth().clickable {
                                                param = def.key
                                                pickerOpen = false
                                                query = ""
                                                if (!textEdited) text = suggestMeasureText(label)
                                                if (name.isBlank()) name = label
                                            }.padding(horizontal = 16.dp, vertical = 8.dp),
                                            bold = def.key == param,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(t.t("customMeasure.periodLabel"), HcTypeRoles.Label)
                SettingsDropdown(
                    value = period,
                    options = MEASURE_PERIOD_KEYS.map { SettingsOption(it, t.t("customMeasure.period.$it")) },
                    onChange = { period = it },
                    modifier = Modifier.fillMaxWidth(),
                ) { label ->
                    val shape = RoundedCornerShape(HcDimens.RadiusCard)
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.Page, shape)
                            .border(1.dp, HcColors.FieldBorder, shape).padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) { HcText(label, HcTypeRoles.Input) }
                }
                HcText(t.t("customMeasure.periodHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcTextField(
                    text,
                    {
                        textEdited = true
                        text = clampMeasureText(it)
                    },
                    label = t.t("customMeasure.textLabel"),
                    standard = true,
                    singleLine = false,
                )
                HcText(
                    t.t("customMeasure.textHint", "lines" to CUSTOM_MEASURE_MAX_LINES, "chars" to CUSTOM_MEASURE_MAX_LINE_LENGTH) +
                        " · " + text.split("\n").joinToString(" / ") { it.length.toString() },
                    HcTypeRoles.Small,
                    color = HcColors.TextSecondary,
                )
            }
        }
    }
}

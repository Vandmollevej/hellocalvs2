package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.screens.onboarding.KitchenConversion
import dk.packroff.hellocal.screens.onboarding.KitchenConversions
import dk.packroff.hellocal.ui.HcChoiceChip

/**
 * Native port of src/components/recipe-view/RecipeUnitToggle.tsx — skift
 * mellem køkkenmål (dl, spsk, tsk) og gram på en rets ingredienser.
 * [grams] = true betyder gram.
 */
@Composable
internal fun RecipeUnitToggle(grams: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val t = LocalTranslator.current
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        HcChoiceChip(t.t("recipeUnits.measures"), !grams, { onChange(false) })
        HcChoiceChip(t.t("recipeUnits.grams"), grams, { onChange(true) })
    }
}

/** Omregningstabellen (GET /api/kitchen-conversions); tom indtil den er hentet. */
@Composable
internal fun rememberKitchenConversions(): List<KitchenConversion> {
    var items by remember { mutableStateOf<List<KitchenConversion>>(emptyList()) }
    LaunchedEffect(Unit) { items = runCatching { KitchenConversions.table().items }.getOrDefault(emptyList()) }
    return items
}

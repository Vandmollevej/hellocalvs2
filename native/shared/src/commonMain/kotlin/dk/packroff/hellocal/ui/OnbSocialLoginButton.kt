package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles

/**
 * src/components/hf/SocialLoginButton.tsx with an onClick (the login screen
 * keeps its own private copy). Provider colours are tokens (design.md §6.3).
 */
@Composable
fun OnbSocialLoginButton(provider: String, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val background = when (provider) {
        "google" -> HcColors.Google
        "facebook" -> HcColors.Facebook
        else -> HcColors.Action
    }
    Row(
        modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(background)
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(47.dp), contentAlignment = Alignment.Center) { HcRemoteImage("/icon-$provider.png", Modifier.size(20.dp)) }
        HcText(label, HcTypeRoles.Button, Modifier.weight(1f), color = HcColors.White, align = TextAlign.Center)
        Box(Modifier.width(47.dp))
    }
}

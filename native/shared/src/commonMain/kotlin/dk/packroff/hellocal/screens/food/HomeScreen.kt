package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodProfileCircle
import dk.packroff.hellocal.ui.FoodSheetDots
import dk.packroff.hellocal.ui.FoodSheetSkipButton
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.VSpace
import dk.packroff.hellocal.ui.foodInitialsOf
import dk.packroff.hellocal.ui.icons.HcIcon

/**
 * Pieces of the front page that belong to other feature areas. Their ports
 * plug in here so the front page shows them exactly like the web
 * (src/app/page.tsx renders <HeartRateSpikePrompt/> and <WeighInPrompts/>, and
 * the welcome sheet's "Start guiden" opens <OnboardingWizard forceVisible/>).
 * TODO(parity): the activity, weight and onboarding areas set these.
 */
object HomeSlots {
    var heartRateSpikePrompt: (@Composable () -> Unit)? = null
    var weighInPrompts: (@Composable () -> Unit)? = null
    var onboardingWizard: (@Composable (onClose: () -> Unit) -> Unit)? = null
}

/** Native port of src/app/page.tsx (the logged-in front page). */
@Composable
fun HomeScreen(args: RouteArgs) {
    val density = LocalDensity.current.density
    var showOnboarding by remember { mutableStateOf(false) }
    var showGuide by remember { mutableStateOf(false) }
    var menuSheetOpen by remember { mutableStateOf(false) }
    var rootTop by remember { mutableStateOf(0f) }
    var rootBottom by remember { mutableStateOf(0f) }
    var heroTop by remember { mutableStateOf(0f) }

    LaunchedEffect(Unit) {
        showOnboarding = FoodPrefs.get(FoodPrefs.ONBOARDING_DISMISSED_KEY) != "1"
        FoodFamily.refresh()
        FoodProfile.refresh()
        FoodSubscription.load()
        OfflineProductQueue.flush()
    }

    fun dismissOnboarding() {
        showOnboarding = false
        FoodPrefs.set(FoodPrefs.ONBOARDING_DISMISSED_KEY, "1")
    }

    Box(
        Modifier.fillMaxSize().background(HcColors.Cream).onGloballyPositioned {
            rootTop = it.positionInRoot().y / density
            rootBottom = rootTop + it.size.height / density
        },
    ) {
        Column(Modifier.fillMaxSize()) {
            HomeTopBar()
            Box(
                Modifier.padding(top = 32.dp).fillMaxWidth().height(HERO_HEIGHT.dp).onGloballyPositioned {
                    heroTop = it.positionInRoot().y / density
                },
            ) {
                HomeStatsWheel(if (FoodPrefs.fabSide == "left") "right" else "left")
            }
            // The list lies over the hero (z-10): the wheel's rows turn in behind it.
            HomeDailyList(Modifier.weight(1f).padding(top = 8.dp))
        }
        // The add-button's fan (z-30) lies above everything, at the hero's place.
        Box(Modifier.fillMaxWidth().height(HERO_HEIGHT.dp).offset(y = (heroTop - rootTop).dp)) {
            HomeAddButton(
                onOpen = { dismissOnboarding() },
                // The circle may not rise above the page top nor sink below the bottom navigation.
                topLimitDp = rootTop - heroTop,
                bottomLimitDp = rootBottom - heroTop,
                onOpenMenuSheet = { menuSheetOpen = true },
            )
        }
        HomeFooterArc(Modifier.align(Alignment.BottomCenter), onOpenMenuSheet = { menuSheetOpen = true })
    }

    if (showOnboarding) {
        HomeWelcomeSheet(onClose = { dismissOnboarding() }, onStartGuide = { showGuide = true })
    }
    if (showGuide) HomeSlots.onboardingWizard?.invoke { showGuide = false }
    if (menuSheetOpen) AddMenuSheet(onClose = { menuSheetOpen = false })

    HomeSlots.heartRateSpikePrompt?.invoke()
    HomeSlots.weighInPrompts?.invoke()
}

/** src/components/TopBar.tsx — the watcher phone icon (family) and the profile circle. */
@Composable
private fun HomeTopBar() {
    val nav = LocalNavigator.current
    val status = FoodFamily.status
    val watcher = status?.presence?.firstOrNull()
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().height(52.dp).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (watcher != null) WatchPhoneIcon(watcher.displayName)
        Box(Modifier.size(44.dp).clickable { nav.push("/profile") }, contentAlignment = Alignment.CenterEnd) {
            FoodProfileCircle(status?.activeProfile?.displayName ?: "", outlined = true)
        }
    }
}

/** src/components/family/WatchPhoneIcon.tsx — blue phone with the initials of who is on the account. */
@Composable
private fun WatchPhoneIcon(name: String) {
    Box(
        Modifier.size(22.dp, 32.dp).clip(RoundedCornerShape(4.dp)).background(HcColors.Watch).border(1.5.dp, HcColors.White, RoundedCornerShape(4.dp)),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(Modifier.padding(top = 3.5.dp).size(6.dp, 1.5.dp).clip(RoundedCornerShape(1.dp)).background(HcColors.White))
        HcText(foodInitialsOf(name), HcTypeRoles.Micro, Modifier.align(Alignment.Center).padding(top = 3.dp), color = HcColors.White, bold = true)
    }
}

/** src/components/WelcomeSheet.tsx — welcome slides after sign-up. */
@Composable
private fun HomeWelcomeSheet(onClose: () -> Unit, onStartGuide: () -> Unit) {
    val t = LocalTranslator.current
    val slides = listOf(
        Triple("Heartbeat", "welcomeSheet.slide1Title", "welcomeSheet.slide1Text"),
        Triple("Fingerprint", "welcomeSheet.slide2Title", "welcomeSheet.slide2Text"),
        Triple("Calendar", "welcomeSheet.slide3Title", "welcomeSheet.slide3Text"),
        Triple("ChartBar", "welcomeSheet.slide4Title", "welcomeSheet.slide4Text"),
    )
    var index by remember { mutableStateOf(0) }
    val (icon, titleKey, textKey) = slides[index]
    val isLast = index == slides.lastIndex
    HcBottomSheet(onDismiss = onClose) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Box(Modifier.size(160.dp).clip(CircleShape).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                HcIcon(icon, size = 72.dp, color = HcColors.Green, stroke = 1.4f)
            }
            HcText(t.t(titleKey), HcTypeRoles.PageTitle, Modifier.fillMaxWidth(), align = TextAlign.Center)
            HcText(t.t(textKey), HcTypeRoles.BodyLg, Modifier.fillMaxWidth(), align = TextAlign.Center)
        }
        Box(Modifier.fillMaxWidth().height(40.dp), contentAlignment = Alignment.Center) {
            FoodSheetDots(slides.size, index) { index = it }
            if (!isLast) {
                Box(
                    Modifier.align(Alignment.CenterEnd).padding(end = 60.dp).size(40.dp).clickable { index += 1 },
                    contentAlignment = Alignment.Center,
                ) { HcIcon("ChevronRight", size = 24.dp, color = HcColors.Black) }
            }
        }
        VSpace(16.dp)
        HcButton(t.t("welcomeSheet.startGuide"), onClick = {
            onClose()
            onStartGuide()
        })
        FoodSheetSkipButton(t.t("welcomeSheet.skip"), onClose)
    }
}

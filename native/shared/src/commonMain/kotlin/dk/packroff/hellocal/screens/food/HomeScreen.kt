package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.screens.profile.ProfileOnboardingWizard
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodProfileCircle
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcSheetDots
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcSheetSkipButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.foodInitialsOf
import dk.packroff.hellocal.ui.icons.HcIcon

/**
 * Native port of src/app/page.tsx (the logged-in front page): the pulse line
 * (HomeWaves) behind the top bar + hero, the daily list, the footer half
 * circle, and the two start-up prompts (HeartRateSpikePrompt, WeighInPrompts).
 * The welcome sheet's "Start guiden" opens the onboarding wizard (Hero.tsx).
 */
@Composable
fun HomeScreen(args: RouteArgs) {
    val density = LocalDensity.current.density
    var showOnboarding by remember { mutableStateOf(false) }
    var showGuide by remember { mutableStateOf(false) }
    var rootTop by remember { mutableStateOf(0f) }
    var rootBottom by remember { mutableStateOf(0f) }
    var heroTop by remember { mutableStateOf(0f) }
    var heroMeasured by remember { mutableStateOf(false) }
    var topBlockTop by remember { mutableStateOf(0f) }

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
            // <div className="relative flex-none"><HomeWaves/><TopBar/><Hero/></div>
            Box(
                Modifier.fillMaxWidth().onGloballyPositioned { topBlockTop = it.positionInRoot().y / density },
            ) {
                // The pulse's lowest point sits just above the wheel's last number.
                val pulseY = if (heroMeasured) heroTop - topBlockTop + statsWheelLastRowY() - PULSE_ABOVE_LAST_ROW else null
                HomeWaves(pulseY, Modifier.matchParentSize())
                Column(Modifier.fillMaxWidth()) {
                    HomeTopBar()
                    Box(
                        Modifier.padding(top = 32.dp).fillMaxWidth().height(HERO_HEIGHT.dp).onGloballyPositioned {
                            heroTop = it.positionInRoot().y / density
                            heroMeasured = true
                        },
                    ) {
                        HomeStatsWheel(if (FoodPrefs.fabSide == "left") "right" else "left")
                    }
                }
            }
            // The list lies over the hero (z-10): the wheel's rows turn in behind it.
            HomeDailyList(Modifier.weight(1f).padding(top = 8.dp))
        }
    }

    if (showOnboarding) {
        HomeWelcomeSheet(onClose = { dismissOnboarding() }, onStartGuide = { showGuide = true })
    }
    if (showGuide) ProfileOnboardingWizard(forceVisible = true, onClose = { showGuide = false })

    HomeHeartRateSpikePrompt()
    HomeWeighInPrompts()
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

private data class WelcomeSlide(val icon: String, val titleKey: String, val textKey: String)

private val WELCOME_SLIDES = listOf(
    WelcomeSlide("Heartbeat", "welcomeSheet.slide1Title", "welcomeSheet.slide1Text"),
    WelcomeSlide("Fingerprint", "welcomeSheet.slide2Title", "welcomeSheet.slide2Text"),
    WelcomeSlide("Calendar", "welcomeSheet.slide3Title", "welcomeSheet.slide3Text"),
    WelcomeSlide("ChartBar", "welcomeSheet.slide4Title", "welcomeSheet.slide4Text"),
)

/**
 * src/components/WelcomeSheet.tsx — welcome slides after sign-up (full sheet).
 * "Start guiden" closes the sheet and then opens the guide; "Spring over" (or
 * a drag down) just closes.
 */
@Composable
private fun HomeWelcomeSheet(onClose: () -> Unit, onStartGuide: () -> Unit) {
    val t = LocalTranslator.current
    var index by remember { mutableStateOf(0) }
    var startGuide by remember { mutableStateOf(false) }
    val slide = WELCOME_SLIDES[index]
    val isLast = index == WELCOME_SLIDES.lastIndex
    HcBottomSheet(
        onDismiss = {
            onClose()
            if (startGuide) onStartGuide()
        },
        title = t.t(slide.titleKey),
        size = HcSheetSize.Full,
        footer = {
            val close = LocalHcSheetClose.current
            BoxWithConstraints(Modifier.fillMaxWidth().height(40.dp), contentAlignment = Alignment.Center) {
                val w = maxWidth
                val progressLabel = t.t("welcomeSheet.progress", "current" to (index + 1), "total" to WELCOME_SLIDES.size)
                Box(Modifier.semantics { contentDescription = progressLabel }) {
                    HcSheetDots(WELCOME_SLIDES.size, index) { index = it }
                }
                if (!isLast) {
                    val nextLabel = t.t("welcomeSheet.nextSlide")
                    // absolute right-[20%] size-10
                    Box(
                        Modifier.align(Alignment.CenterEnd).padding(end = w * 0.2f).size(40.dp)
                            .semantics { contentDescription = nextLabel }
                            .clickable { index += 1 },
                        contentAlignment = Alignment.Center,
                    ) { HcIcon("ChevronRight", size = 24.dp, color = HcColors.Black) }
                }
            }
            HcButton(
                t.t("welcomeSheet.startGuide"),
                onClick = {
                    startGuide = true
                    close()
                },
                modifier = Modifier.padding(top = 16.dp),
            )
            HcSheetSkipButton(t.t("welcomeSheet.skip"))
        },
    ) {
        Column(
            Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterVertically),
        ) {
            Box(Modifier.size(160.dp).clip(CircleShape).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                HcIcon(slide.icon, size = 72.dp, color = HcColors.Green, stroke = 1.4f)
            }
            HcText(t.t(slide.titleKey), HcTypeRoles.PageTitle, Modifier.fillMaxWidth(), align = TextAlign.Center)
            HcText(t.t(slide.textKey), HcTypeRoles.BodyLg, Modifier.fillMaxWidth(), align = TextAlign.Center)
        }
    }
}

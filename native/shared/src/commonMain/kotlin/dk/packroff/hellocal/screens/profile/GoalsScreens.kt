package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileBathScaleIcon
import dk.packroff.hellocal.ui.ProfileEllipsisText
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfileTanRow
import dk.packroff.hellocal.ui.icons.HcIcon

/** Native port of src/app/profile/goals/page.tsx (mobile layout: energy goal and upcoming goals as own pages). */
@Composable
fun GoalsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var goals by remember { mutableStateOf<List<Goal>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            goals = GoalsApi.list()
        } catch (e: Exception) {
            error = true
        }
        loading = false
    }

    HcScreen(title = t.t("goals.title"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            // Outline only — the background is the page's own cream.
            HcButton(
                t.t("goals.createSubGoal"),
                onClick = { nav.push("/profile/goals/new") },
                kind = HcButtonKind.Secondary,
                leading = { HcIcon("Plus", size = 18.dp, stroke = 2.5f, color = HcColors.Action) },
            )
            // Kaloriemål (docs/ACTIVITY-PAL.md F6): energy need → daily budget.
            ProfileTanRow(onClick = { nav.push("/profile/energy-goal") }) {
                HcText(t.t("energyGoal.title"), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                HcIcon("ChevronRight", size = 19.dp, color = HcColors.Black)
            }
            ProfileTanRow(onClick = { nav.push("/profile/goals/upcoming") }) {
                HcText(t.t("goals.upcomingTitle"), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                HcIcon("ChevronRight", size = 19.dp, color = HcColors.Black)
            }
            when {
                loading -> HcLoader()
                error || goals.isEmpty() -> HcText(
                    if (error) t.t("goals.loadError") else t.t("goals.empty"),
                    HcTypeRoles.Body,
                    Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 32.dp),
                    color = HcColors.TextSecondary,
                    align = TextAlign.Center,
                )
                else -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    goals.forEach { goal -> GoalRow(goal) { nav.push("/profile/goals/${goal.id}") } }
                }
            }
        }
    }
}

@Composable
private fun GoalRow(goal: Goal, onOpen: () -> Unit) {
    val t = LocalTranslator.current
    val completed = GoalFormat.isCompleted(goal)
    val summary = goal.targets.joinToString(" · ") { "${t.t(GoalFormat.targetNameKey(it.type))} ${GoalFormat.value(it.value)} ${it.unit}" }
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 66.dp).clip(shape).background(HcColors.Tan, shape).border(1.dp, HcColors.TanDark, shape)
            .clickable(onClick = onOpen).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        GoalDateSquare(ProfileDates.goalDisplayDate(goal), completed)
        Column(Modifier.weight(1f)) {
            HcText(summary, HcTypeRoles.Body, bold = true, color = HcColors.Black, maxLines = 2)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (completed) HcIcon("Check", size = 14.dp, stroke = 3f, color = HcColors.Green)
                HcText(
                    when {
                        completed -> t.t("goals.completedAria")
                        goal.targetDate != null -> t.t("goals.targetDateLabel", "date" to ProfileDates.goalDate(goal.targetDate))
                        else -> t.t("goals.createdLabel", "date" to ProfileDates.goalDate(goal.createdAt))
                    },
                    HcTypeRoles.Small,
                    color = HcColors.TextSecondary,
                )
            }
        }
        HcIcon("ChevronRight", size = 19.dp, color = HcColors.Black)
    }
}

/** Native port of src/app/profile/goals/upcoming/page.tsx. */
@Composable
fun UpcomingGoalsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    HcScreen(title = t.t("goals.upcomingTitle")) {
        UpcomingGoalsList()
    }
}

/** src/components/UpcomingGoalsList.tsx */
@Composable
fun UpcomingGoalsList() {
    val t = LocalTranslator.current
    var goals by remember { mutableStateOf<List<Goal>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try {
            goals = GoalFormat.upcoming(GoalsApi.list(), ProfileDates.todayIso())
        } catch (e: Exception) {
            error = true
        }
        loading = false
    }
    if (loading || error || goals.isEmpty()) {
        HcText(
            when {
                loading -> t.t("goals.loading")
                error -> t.t("goals.loadError")
                else -> t.t("goals.upcomingEmpty")
            },
            HcTypeRoles.Body,
            Modifier.fillMaxWidth().padding(16.dp),
            color = HcColors.TextSecondary,
            align = TextAlign.Center,
        )
        return
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        goals.forEach { goal -> key(goal.id) { UpcomingGoalBar(goal) } }
    }
}

@Composable
private fun CategoryIcon(category: String) {
    Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
        when (category) {
            "weight" -> ProfileBathScaleIcon(20.dp)
            "body" -> HcIcon("RulerMeasure", size = 20.dp, color = HcColors.Black)
            else -> HcIcon("Meat", size = 20.dp, color = HcColors.Black)
        }
    }
}

/** One bar per goal — tan heading row, cream contents; each target opens editing. */
@Composable
private fun UpcomingGoalBar(goal: Goal) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { open = !open }.padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                GoalFormat.categories(goal).forEach { CategoryIcon(it) }
            }
            HcText(ProfileDates.goalDate(goal.targetDate ?: ""), HcTypeRoles.Body, Modifier.weight(1f).padding(start = 4.dp), bold = true, color = HcColors.Black)
            HcChevron(if (open) ChevronDirection.Down else ChevronDirection.Right, color = HcColors.Black)
        }
        if (open) {
            Column(Modifier.fillMaxWidth().background(HcColors.Cream).padding(horizontal = 16.dp)) {
                goal.targets.forEach { target ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable {
                            nav.push("/profile/goals/${goal.id}/edit?focus=${Location.encode(target.type)}")
                        }.padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        ProfileEllipsisText(t.t(GoalFormat.targetNameKey(target.type)), HcTypeRoles.Body, Modifier.weight(1f))
                        if (target.completedAt != null) HcIcon("Check", size = 16.dp, stroke = 3f, color = HcColors.Green)
                        HcText("${GoalFormat.value(target.value)} ${target.unit}", HcTypeRoles.Body, color = HcColors.TextSecondary)
                        HcChevron(color = HcColors.Black)
                    }
                    HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
                }
                Row(Modifier.fillMaxWidth().height(48.dp).clickable { nav.push("/profile/goals/${goal.id}") }, verticalAlignment = Alignment.CenterVertically) {
                    HcText(t.t("goals.openGoal"), HcTypeRoles.Small, bold = true, underline = true, color = HcColors.Black)
                }
            }
        }
    }
}

/** Native port of src/app/profile/goals/[id]/page.tsx. */
@Composable
fun GoalDetailScreen(args: RouteArgs) {
    val id = args["id"]
    key(id) { GoalDetail(id) }
}

@Composable
private fun GoalDetail(id: String) {
    val t = LocalTranslator.current
    var goal by remember { mutableStateOf<Goal?>(null) }
    // loading | error | notFound | ready
    var status by remember { mutableStateOf("loading") }
    LaunchedEffect(id) {
        status = try {
            val loaded = GoalsApi.get(id)
            goal = loaded
            if (loaded == null) "notFound" else "ready"
        } catch (e: Exception) {
            "error"
        }
    }
    HcScreen(title = t.t("goals.detailTitle"), contentPadding = ProfilePagePadding) {
        val current = goal
        when {
            status == "loading" -> HcLoader()
            status != "ready" || current == null -> HcText(
                if (status == "notFound") t.t("goals.notFound") else t.t("goals.loadError"),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().padding(start = 32.dp, end = 32.dp, top = 48.dp),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
            else -> ProfilePage {
                val completed = GoalFormat.isCompleted(current)
                val shape = RoundedCornerShape(16.dp)
                Row(
                    Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).border(1.dp, HcColors.TanDark, shape).padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    GoalDateSquare(ProfileDates.goalDisplayDate(current), completed)
                    Column {
                        HcText(
                            when {
                                completed -> t.t("goals.completedAria")
                                current.targetDate != null -> t.t("goals.targetDateLabel", "date" to ProfileDates.goalDate(current.targetDate))
                                else -> t.t("goals.title")
                            },
                            HcTypeRoles.Body,
                            bold = true,
                        )
                        HcText(t.t("goals.createdLabel", "date" to ProfileDates.goalDate(current.createdAt)), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    }
                }
                Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp)) {
                    current.targets.forEachIndexed { index, target ->
                        if (index > 0) HorizontalDivider(thickness = 1.dp, color = HcColors.GrayBorder)
                        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column(Modifier.weight(1f)) {
                                HcText(t.t(GoalFormat.targetNameKey(target.type)), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                                HcText("${GoalFormat.value(target.value)} ${target.unit}", HcTypeRoles.Body, color = HcColors.TextSecondary)
                            }
                            if (target.completedAt != null) GoalReachedBadge()
                        }
                    }
                }
            }
        }
    }
}

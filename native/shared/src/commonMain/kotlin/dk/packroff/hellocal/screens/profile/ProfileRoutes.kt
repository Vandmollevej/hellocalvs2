package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.nav.ScreenRoute

object ProfileRoutes {
    val routes = listOf(
        ScreenRoute("/profile") { ProfileScreen(it) },
        ScreenRoute("/profile/edit") { ProfileEditScreen(it) },
        ScreenRoute("/profile/change-password") { ChangePasswordScreen(it) },
        ScreenRoute("/profile/height") { HeightLockScreen(it) },
        ScreenRoute("/profile/target-weight") { TargetWeightRedirectScreen(it) },
        ScreenRoute("/profile/start-weight") { StartWeightLockScreen(it) },
        ScreenRoute("/profile/start-weight/verify") { StartWeightVerifyScreen(it) },
        ScreenRoute("/profile/energy-goal") { EnergyGoalScreen(it) },
        ScreenRoute("/profile/goals") { GoalsScreen(it) },
        ScreenRoute("/profile/goals/new") { NewGoalScreen(it) },
        ScreenRoute("/profile/goals/upcoming") { UpcomingGoalsScreen(it) },
        ScreenRoute("/profile/goals/[id]") { GoalDetailScreen(it) },
        ScreenRoute("/profile/goals/[id]/edit") { EditGoalScreen(it) },
        ScreenRoute("/profile/body-measurements") { BodyMeasurementsScreen(it) },
        ScreenRoute("/profile/weight-calibration") { WeightCalibrationScreen(it) },
        ScreenRoute("/profile/sleep") { SleepScreen(it) },
        ScreenRoute("/profile/points") { PointsScreen(it) },
        ScreenRoute("/profile/notifications") { NotificationsScreen(it) },
        ScreenRoute("/profile/messages") { MessagesScreen(it) },
        ScreenRoute("/profile/messages/trash") { MessagesScreen(it, trash = true) },
        ScreenRoute("/profile/login-approval") { LoginApprovalScreen(it) },
        ScreenRoute("/profile/invite") { InviteScreen(it) },
        ScreenRoute("/profile/report-bug") { ReportBugScreen(it) },
        ScreenRoute("/profile/photo-diary") { PhotoDiaryScreen(it) },
        ScreenRoute("/profile/subscription") { SubscriptionScreen(it) },
        ScreenRoute("/profile/subscription/[plan]") { SubscriptionPlanScreen(it) },
        ScreenRoute("/profile/subscription/redeem-points") { RedeemPointsScreen(it) },
    )
}

// Hello Cal native apps (Android + iPhone). One Gradle build:
//   :shared       — all screens, theme, texts and API client (Compose Multiplatform,
//                   compiled for Android and iOS)
//   :androidApp   — the Android app (MainActivity, deep links, widgets, Health Connect)
//   :widgets      — Android home-screen widgets (Glance)
//   :healthconnect — Android Health Connect sync
// The iPhone app is native/iosApp (Xcode project generated from project.yml).
rootProject.name = "HelloCal"

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include(":shared")
include(":androidApp")
include(":widgets")
include(":healthconnect")
project(":widgets").projectDir = file("android/widgets")
project(":healthconnect").projectDir = file("android/healthconnect")

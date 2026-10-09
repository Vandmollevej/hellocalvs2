// The Android app: hosts the shared screens and wires in widgets + Health Connect.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "dk.packroff.hellocal"
    compileSdk = 36

    defaultConfig {
        applicationId = "dk.packroff.hellocal"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        compose = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":shared"))
    implementation(project(":widgets"))
    implementation(project(":healthconnect"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.core:core-splashscreen:1.0.1")

    // Phone features for the shared device layer (device/AndroidDevice.kt).
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")
    implementation("androidx.fragment:fragment-ktx:1.8.6")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.exifinterface:exifinterface:1.3.7")
    // Live barcode/QR scanner (Google Play services UI, no camera permission needed).
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    // Barcode in a still photo — the Play services build, so it shares classes with the code scanner.
    implementation("com.google.android.gms:play-services-mlkit-barcode-scanning:18.3.1")
    // On-device OCR (Latin script, bundled in the app so it works offline at once).
    implementation("com.google.mlkit:text-recognition:16.0.1")
}

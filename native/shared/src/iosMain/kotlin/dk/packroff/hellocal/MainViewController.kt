package dk.packroff.hellocal

import androidx.compose.ui.window.ComposeUIViewController
import dk.packroff.hellocal.app.HelloCalApp
import platform.UIKit.UIViewController

/** Entry point used by iosApp/HelloCal/HelloCalApp.swift. */
fun MainViewController(): UIViewController = ComposeUIViewController { HelloCalApp() }

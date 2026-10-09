package dk.packroff.hellocal

import android.app.Application
import dk.packroff.hellocal.device.AndroidDevice
import dk.packroff.hellocal.platform.AndroidPlatform
import dk.packroff.hellocal.platform.Device
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.widgets.WidgetRefresh

class HelloCalApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AndroidPlatform.init(this)
        // Camera, photo library, scanner, OCR, speech, share sheet, fingerprint (shared/.../platform/Device.kt).
        AndroidDevice.init(this)
        Device.platform = AndroidDevice
        NativeHooks.onDeviceToken = { token ->
            dk.packroff.hellocal.widgets.DeviceTokenStore.write(this, token)
            dk.packroff.hellocal.healthconnect.DeviceTokenStore.write(this, token)
            WidgetRefresh.schedule(this)
            WidgetRefresh.now(this)
        }
        NativeHooks.onRegistrationChanged = { WidgetRefresh.now(this) }
    }
}

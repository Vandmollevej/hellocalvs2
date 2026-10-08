package dk.packroff.hellocal

import android.app.Application
import dk.packroff.hellocal.platform.AndroidPlatform
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.widgets.WidgetRefresh

class HelloCalApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AndroidPlatform.init(this)
        NativeHooks.onDeviceToken = { token ->
            dk.packroff.hellocal.widgets.DeviceTokenStore.write(this, token)
            dk.packroff.hellocal.healthconnect.DeviceTokenStore.write(this, token)
            WidgetRefresh.schedule(this)
            WidgetRefresh.now(this)
        }
        NativeHooks.onRegistrationChanged = { WidgetRefresh.now(this) }
    }
}

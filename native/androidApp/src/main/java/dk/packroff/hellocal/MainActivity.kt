package dk.packroff.hellocal

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.FragmentActivity
import dk.packroff.hellocal.app.HelloCalApp
import dk.packroff.hellocal.device.AndroidDevice
import dk.packroff.hellocal.nav.DeepLinks
import dk.packroff.hellocal.platform.Device

/**
 * FragmentActivity (a ComponentActivity) because BiometricPrompt needs one.
 * The activity-result launchers for the device layer are registered here,
 * before the activity starts, so a result still arrives if Android re-creates
 * the activity while the camera or picker is open.
 */
class MainActivity : FragmentActivity() {
    internal val requestPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        AndroidDevice.onPermissionResult(granted)
    }
    internal val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        AndroidDevice.onPictureResult(saved)
    }
    internal val pickOne = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        AndroidDevice.onPickResult(listOfNotNull(uri))
    }
    internal val pickMany = registerForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(AndroidDevice.MAX_PICK)) { uris ->
        AndroidDevice.onPickResult(uris)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AndroidDevice.attach(this)
        enableEdgeToEdge()
        intent?.let(::routeDeepLink)
        setContent { HelloCalApp() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        routeDeepLink(intent)
    }

    override fun onResume() {
        super.onResume()
        AndroidDevice.onResumed()
    }

    /** web visibilitychange → hidden (photo diary locks again) — not when we opened the camera/picker ourselves. */
    override fun onStop() {
        super.onStop()
        if (!AndroidDevice.expectingExternal && !isChangingConfigurations) Device.notifyAppBackground()
    }

    override fun onDestroy() {
        AndroidDevice.detach(this)
        super.onDestroy()
    }

    /** hellocal://<web path> → the same screen as the web path. */
    private fun routeDeepLink(intent: Intent) {
        intent.data?.toString()?.let(DeepLinks::open)
    }
}

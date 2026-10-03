// Health Connect requires an activity that explains how the app uses health
// data. It opens Hello Cal's privacy policy and closes itself.
package dk.packroff.hellocal.healthconnect

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(HealthConnectConfig.PRIVACY_URL)))
        } catch (_: ActivityNotFoundException) {
            // No browser installed; nothing else to show.
        }
        finish()
    }
}

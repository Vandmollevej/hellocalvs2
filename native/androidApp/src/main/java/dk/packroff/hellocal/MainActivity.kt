package dk.packroff.hellocal

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dk.packroff.hellocal.app.HelloCalApp
import dk.packroff.hellocal.nav.DeepLinks

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        intent?.let(::routeDeepLink)
        setContent { HelloCalApp() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        routeDeepLink(intent)
    }

    /** hellocal://<web path> → the same screen as the web path. */
    private fun routeDeepLink(intent: Intent) {
        intent.data?.toString()?.let(DeepLinks::open)
    }
}

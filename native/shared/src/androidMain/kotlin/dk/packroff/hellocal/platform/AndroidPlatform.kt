package dk.packroff.hellocal.platform

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Call once from Application.onCreate. */
object AndroidPlatform {
    fun init(context: Context) {
        val app = context.applicationContext
        NativeHooks.secureStorage = EncryptedStorage(app)
        NativeHooks.openExternalUrl = { url ->
            app.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        NativeHooks.deviceRegion = { java.util.Locale.getDefault().country.takeIf { it.isNotEmpty() } }
    }
}

private class EncryptedStorage(context: Context) : SecureStorage {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "hellocal_app_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    override fun get(key: String): String? = prefs.getString(key, null)

    override fun set(key: String, value: String?) {
        prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    }
}

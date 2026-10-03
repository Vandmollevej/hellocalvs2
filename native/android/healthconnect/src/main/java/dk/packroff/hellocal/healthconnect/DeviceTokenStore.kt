// Same encrypted prefs file and key as the widgets module, so the token the
// app stores once at login is shared by both modules.
package dk.packroff.hellocal.healthconnect

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object DeviceTokenStore {
    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        "hellocal_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun read(context: Context): String? = prefs(context).getString("deviceToken", null)

    fun write(context: Context, token: String) = prefs(context).edit().putString("deviceToken", token).apply()
}

package dk.packroff.hellocal.platform

/**
 * Where the shared screens hand over to platform-only code. The Android app
 * (HelloCalApplication) and the iPhone app (iosApp/HelloCalApp.swift) fill
 * these in at start-up.
 */
object NativeHooks {
    /** Encrypted key/value storage (Android: EncryptedSharedPreferences, iPhone: Keychain). */
    var secureStorage: SecureStorage = InMemoryStorage()

    /** Called with the personal device token after login — widgets and health sync use it. */
    var onDeviceToken: (String) -> Unit = {}

    /** Called after anything was registered/changed, so widgets refresh at once. */
    var onRegistrationChanged: () -> Unit = {}

    /** Called on logout: widgets and health sync must forget the token. */
    var onLogout: () -> Unit = {}

    /** Opens a URL outside the app (browser, mail, phone). */
    var openExternalUrl: (String) -> Unit = {}
}

interface SecureStorage {
    fun get(key: String): String?
    fun set(key: String, value: String?)
}

private class InMemoryStorage : SecureStorage {
    private val map = mutableMapOf<String, String>()
    override fun get(key: String): String? = map[key]
    override fun set(key: String, value: String?) {
        if (value == null) map.remove(key) else map[key] = value
    }
}

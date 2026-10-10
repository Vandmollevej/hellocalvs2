package dk.packroff.hellocal.api

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** GET /api/auth/me → user (same fields as the web AuthGate uses). */
@Serializable
data class SessionUser(
    val id: String,
    val email: String? = null,
    val displayName: String? = null,
    val appLocale: String? = null,
    val hasPasskey: Boolean = false,
    val hasHealthDataConsent: Boolean = false,
    val emailVerified: Boolean = false,
    val hasPhone: Boolean = false,
    val phoneRequired: Boolean = false,
)

sealed interface LoginResult {
    data object Success : LoginResult
    data class ApprovalRequired(val data: JsonObject) : LoginResult
    data class Failed(val message: String) : LoginResult
}

object Session {
    enum class State { Unknown, LoggedOut, LoggedIn }

    var state by mutableStateOf(State.Unknown)
        private set
    var user by mutableStateOf<SessionUser?>(null)
        private set

    /** On start: is the stored cookie still a valid login? */
    suspend fun restore() {
        if (!PersistentCookies.hasAny()) {
            state = State.LoggedOut
            return
        }
        refresh()
    }

    suspend fun refresh() {
        try {
            val me = Api.get("/api/auth/me").jsonObject["user"]!!
            user = ApiJson.decodeFromJsonElement(SessionUser.serializer(), me)
            state = State.LoggedIn
            ensureDeviceToken()
        } catch (e: ApiException) {
            if (e.status == 401) markLoggedOut() else state = if (user != null) State.LoggedIn else State.LoggedOut
        } catch (e: Exception) {
            // Offline: keep the stored login, screens show their own error state.
            state = if (PersistentCookies.hasAny()) State.LoggedIn else State.LoggedOut
        }
    }

    /** POST /api/auth/login — same request as the web login form. */
    suspend fun login(email: String, password: String): LoginResult = try {
        val response = Api.post("/api/auth/login", mapOf("email" to email, "password" to password)).jsonObject
        if (response["approvalRequired"]?.jsonPrimitive?.contentOrNull == "true") {
            LoginResult.ApprovalRequired(response)
        } else {
            refresh()
            LoginResult.Success
        }
    } catch (e: ApiException) {
        LoginResult.Failed(e.message)
    } catch (e: Exception) {
        LoginResult.Failed(e.message ?: "Netværksfejl")
    }

    /** After any login flow that set the session cookie (passkey, OAuth, approval). */
    suspend fun completedExternally() = refresh()

    suspend fun logout() {
        runCatching { Api.post("/api/auth/logout") }
        PersistentCookies.clear()
        OfflineCache.clear()
        NativeHooks.secureStorage.set(DEVICE_TOKEN_KEY, null)
        NativeHooks.onLogout()
        markLoggedOut()
    }

    internal fun onUnauthorized() {
        if (state == State.LoggedIn) markLoggedOut()
    }

    private fun markLoggedOut() {
        user = null
        state = State.LoggedOut
    }

    /**
     * Widgets and Health Connect/Apple Health sync authenticate with a personal
     * device token (docs/HEALTHKIT_COMPANION.md). Create one once per install.
     */
    private suspend fun ensureDeviceToken() {
        val existing = NativeHooks.secureStorage.get(DEVICE_TOKEN_KEY)
        if (existing != null) {
            NativeHooks.onDeviceToken(existing)
            return
        }
        runCatching {
            val token = Api.post("/api/integrations/healthkit/tokens", mapOf("label" to "Hello Cal-app")).jsonObject["token"]
                ?.jsonPrimitive?.contentOrNull ?: return
            NativeHooks.secureStorage.set(DEVICE_TOKEN_KEY, token)
            NativeHooks.onDeviceToken(token)
        }
    }

    private const val DEVICE_TOKEN_KEY = "deviceToken"
}

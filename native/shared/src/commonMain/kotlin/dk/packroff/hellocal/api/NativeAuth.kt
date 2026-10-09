package dk.packroff.hellocal.api

import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.platform.NativeHooks
import io.ktor.util.generateNonce
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Hand-off between the system browser and the app (docs/DECISIONS.md
 * 2026-10-08 "Native login-overdragelse", src/lib/native-auth.ts).
 *
 * Login: Google/Apple/Facebook run in the system browser (Google blocks web
 * views), which has no app cookie. The app opens
 * /api/auth/oauth/<provider>?native=1&challenge=<S256>, the callback returns to
 * hellocal://auth/complete?code=…, and [exchange] trades the one-time code plus
 * the PKCE verifier for the normal session cookie.
 *
 * Integrations: [integrationConnectUrl] fetches a short-lived, single-use
 * code bound to the logged-in user first; the provider's callback returns to
 * hellocal://settings/integrations/<app>?connected=1 (or ?error=…).
 */
object NativeAuth {
    /** Path of hellocal://auth/complete after Location.parse. */
    const val COMPLETE_PATH = "/auth/complete"

    private const val VERIFIER_KEY = "oauthVerifier"

    /** URL that starts a Google/Apple/Facebook login in the system browser. */
    fun oauthStartUrl(provider: String, next: String = "/", consent: Boolean = false): String {
        val verifier = newVerifier()
        NativeHooks.secureStorage.set(VERIFIER_KEY, verifier)
        val challenge = base64Url(Sha256.digest(verifier.encodeToByteArray()))
        return buildString {
            append(HelloCalConfig.BASE_URL).append("/api/auth/oauth/").append(provider)
            append("?native=1&challenge=").append(challenge)
            if (next != "/") append("&next=").append(Location.encode(next))
            if (consent) append("&consent=1")
        }
    }

    /** POST /api/auth/native/exchange — sets the session cookie, then refreshes the session. */
    suspend fun exchange(code: String): LoginResult {
        val verifier = NativeHooks.secureStorage.get(VERIFIER_KEY)
            ?: return LoginResult.Failed("oauth-expired")
        return try {
            Api.post("/api/auth/native/exchange", mapOf("code" to code, "verifier" to verifier))
            NativeHooks.secureStorage.set(VERIFIER_KEY, null)
            Session.completedExternally()
            LoginResult.Success
        } catch (e: ApiException) {
            val serverCode = ((e.body as? JsonObject)?.get("code") as? JsonPrimitive)?.contentOrNull
            LoginResult.Failed(if (serverCode == "ACCOUNT_BLOCKED") "account-blocked" else "oauth-expired")
        } catch (e: Exception) {
            LoginResult.Failed("oauth")
        }
    }

    /** POST /api/auth/native/connect-code → URL that connects an integration in the system browser. */
    suspend fun integrationConnectUrl(slug: String): String {
        val code = Api.post("/api/auth/native/connect-code").jsonObject["code"]?.jsonPrimitive?.contentOrNull
            ?: throw ApiException(500, "Ingen kode")
        return "${HelloCalConfig.BASE_URL}/api/integrations/$slug/connect?native=" + Location.encode(code)
    }

    /** 43–128 unreserved characters (RFC 7636); ktor's nonce is cryptographically random. */
    private fun newVerifier(): String {
        val sb = StringBuilder()
        while (sb.length < 64) sb.append(generateNonce().filter { it.isLetterOrDigit() })
        return sb.toString().take(128)
    }

    private const val B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

    /** base64url without padding (same as Node's digest("base64url")). */
    internal fun base64Url(bytes: ByteArray): String = buildString {
        var i = 0
        while (i < bytes.size) {
            val b0 = bytes[i].toInt() and 0xFF
            val b1 = if (i + 1 < bytes.size) bytes[i + 1].toInt() and 0xFF else -1
            val b2 = if (i + 2 < bytes.size) bytes[i + 2].toInt() and 0xFF else -1
            append(B64[b0 shr 2])
            append(B64[((b0 and 0x03) shl 4) or (if (b1 >= 0) b1 shr 4 else 0)])
            if (b1 >= 0) append(B64[((b1 and 0x0F) shl 2) or (if (b2 >= 0) b2 shr 6 else 0)])
            if (b2 >= 0) append(B64[b2 and 0x3F])
            i += 3
        }
    }
}

/** Plain SHA-256 (FIPS 180-4) — commonMain has no crypto library. */
internal object Sha256 {
    private val K: IntArray = longArrayOf(
        0x428a2f98L, 0x71374491L, 0xb5c0fbcfL, 0xe9b5dba5L, 0x3956c25bL, 0x59f111f1L, 0x923f82a4L, 0xab1c5ed5L,
        0xd807aa98L, 0x12835b01L, 0x243185beL, 0x550c7dc3L, 0x72be5d74L, 0x80deb1feL, 0x9bdc06a7L, 0xc19bf174L,
        0xe49b69c1L, 0xefbe4786L, 0x0fc19dc6L, 0x240ca1ccL, 0x2de92c6fL, 0x4a7484aaL, 0x5cb0a9dcL, 0x76f988daL,
        0x983e5152L, 0xa831c66dL, 0xb00327c8L, 0xbf597fc7L, 0xc6e00bf3L, 0xd5a79147L, 0x06ca6351L, 0x14292967L,
        0x27b70a85L, 0x2e1b2138L, 0x4d2c6dfcL, 0x53380d13L, 0x650a7354L, 0x766a0abbL, 0x81c2c92eL, 0x92722c85L,
        0xa2bfe8a1L, 0xa81a664bL, 0xc24b8b70L, 0xc76c51a3L, 0xd192e819L, 0xd6990624L, 0xf40e3585L, 0x106aa070L,
        0x19a4c116L, 0x1e376c08L, 0x2748774cL, 0x34b0bcb5L, 0x391c0cb3L, 0x4ed8aa4aL, 0x5b9cca4fL, 0x682e6ff3L,
        0x748f82eeL, 0x78a5636fL, 0x84c87814L, 0x8cc70208L, 0x90befffaL, 0xa4506cebL, 0xbef9a3f7L, 0xc67178f2L,
    ).map { it.toInt() }.toIntArray()

    fun digest(input: ByteArray): ByteArray {
        val h = longArrayOf(
            0x6a09e667L, 0xbb67ae85L, 0x3c6ef372L, 0xa54ff53aL, 0x510e527fL, 0x9b05688cL, 0x1f83d9abL, 0x5be0cd19L,
        ).map { it.toInt() }.toIntArray()
        val bitLength = input.size.toLong() * 8
        val paddedLength = ((input.size + 9 + 63) / 64) * 64
        val msg = ByteArray(paddedLength)
        input.copyInto(msg)
        msg[input.size] = 0x80.toByte()
        for (i in 0 until 8) msg[paddedLength - 1 - i] = (bitLength ushr (8 * i)).toByte()

        val w = IntArray(64)
        for (chunk in 0 until paddedLength step 64) {
            for (i in 0 until 16) {
                val o = chunk + 4 * i
                w[i] = ((msg[o].toInt() and 0xFF) shl 24) or ((msg[o + 1].toInt() and 0xFF) shl 16) or
                    ((msg[o + 2].toInt() and 0xFF) shl 8) or (msg[o + 3].toInt() and 0xFF)
            }
            for (i in 16 until 64) {
                val s0 = w[i - 15].rotateRight(7) xor w[i - 15].rotateRight(18) xor (w[i - 15] ushr 3)
                val s1 = w[i - 2].rotateRight(17) xor w[i - 2].rotateRight(19) xor (w[i - 2] ushr 10)
                w[i] = w[i - 16] + s0 + w[i - 7] + s1
            }
            var a = h[0]
            var b = h[1]
            var c = h[2]
            var d = h[3]
            var e = h[4]
            var f = h[5]
            var g = h[6]
            var hh = h[7]
            for (i in 0 until 64) {
                val bigS1 = e.rotateRight(6) xor e.rotateRight(11) xor e.rotateRight(25)
                val ch = (e and f) xor (e.inv() and g)
                val t1 = hh + bigS1 + ch + K[i] + w[i]
                val bigS0 = a.rotateRight(2) xor a.rotateRight(13) xor a.rotateRight(22)
                val maj = (a and b) xor (a and c) xor (b and c)
                val t2 = bigS0 + maj
                hh = g
                g = f
                f = e
                e = d + t1
                d = c
                c = b
                b = a
                a = t1 + t2
            }
            h[0] += a
            h[1] += b
            h[2] += c
            h[3] += d
            h[4] += e
            h[5] += f
            h[6] += g
            h[7] += hh
        }
        val out = ByteArray(32)
        for (i in 0 until 8) {
            out[4 * i] = (h[i] ushr 24).toByte()
            out[4 * i + 1] = (h[i] ushr 16).toByte()
            out[4 * i + 2] = (h[i] ushr 8).toByte()
            out[4 * i + 3] = h[i].toByte()
        }
        return out
    }
}

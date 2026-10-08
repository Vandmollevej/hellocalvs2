package dk.packroff.hellocal.api

import dk.packroff.hellocal.platform.NativeHooks
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.cookies.CookiesStorage
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Cookie
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.Url
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import io.ktor.util.date.GMTDate
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * The native app talks to exactly the same backend routes as the web app
 * (src/app/api). Login works like the browser: the session cookie set by
 * /api/auth/login is kept (encrypted) and sent on every request.
 */
object HelloCalConfig {
    const val BASE_URL = "https://hellocal.packroff.dk"
}

class ApiException(val status: Int, override val message: String, val body: JsonElement? = null) : Exception(message)

val ApiJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    isLenient = true
    coerceInputValues = true
}

object Api {
    val client: HttpClient by lazy {
        HttpClient {
            expectSuccess = false
            install(ContentNegotiation) { json(ApiJson) }
            install(HttpCookies) { storage = PersistentCookies }
            install(HttpTimeout) {
                requestTimeoutMillis = 60_000
                connectTimeoutMillis = 15_000
            }
            defaultRequest {
                url(HelloCalConfig.BASE_URL)
                header("X-HelloCal-Client", "native")
            }
        }
    }

    suspend fun raw(method: HttpMethod, path: String, build: HttpRequestBuilder.() -> Unit = {}): HttpResponse =
        client.request(path) {
            this.method = method
            build()
        }

    /** GET/POST/… returning parsed JSON; throws ApiException with the server's message on errors. */
    suspend fun send(method: HttpMethod, path: String, body: Any? = null, build: HttpRequestBuilder.() -> Unit = {}): JsonElement {
        val response = raw(method, path) {
            if (body != null) {
                contentType(ContentType.Application.Json)
                setBody(if (body is JsonElement) body else ApiJson.parseToJsonElement(encodeAny(body)))
            }
            build()
        }
        val text = response.bodyAsText()
        val parsed = runCatching { ApiJson.parseToJsonElement(text) }.getOrNull()
        if (!response.status.isSuccess()) {
            val message = (parsed as? JsonObject)?.let { obj ->
                (obj["message"] ?: obj["error"])?.jsonPrimitive?.contentOrNull
            } ?: "HTTP ${response.status.value}"
            if (response.status.value == 401) Session.onUnauthorized()
            throw ApiException(response.status.value, message, parsed)
        }
        return parsed ?: JsonObject(emptyMap())
    }

    suspend fun get(path: String, build: HttpRequestBuilder.() -> Unit = {}) = send(HttpMethod.Get, path, null, build)
    suspend fun post(path: String, body: Any? = null) = send(HttpMethod.Post, path, body ?: JsonObject(emptyMap()))
    suspend fun put(path: String, body: Any? = null) = send(HttpMethod.Put, path, body ?: JsonObject(emptyMap()))
    suspend fun patch(path: String, body: Any? = null) = send(HttpMethod.Patch, path, body ?: JsonObject(emptyMap()))
    suspend fun delete(path: String, body: Any? = null) = send(HttpMethod.Delete, path, body)

    suspend inline fun <reified T> getAs(path: String): T = ApiJson.decodeFromJsonElement(get(path))
    suspend inline fun <reified T> postAs(path: String, body: Any? = null): T = ApiJson.decodeFromJsonElement(post(path, body))

    /** multipart/form-data upload (photos, voice). */
    suspend fun upload(path: String, fields: Map<String, String>, fileField: String, fileName: String, bytes: ByteArray, mime: String): JsonElement {
        val response = raw(HttpMethod.Post, path) {
            setBody(
                MultiPartFormDataContent(
                    formData {
                        fields.forEach { (k, v) -> append(k, v) }
                        append(fileField, bytes, Headers.build {
                            append(HttpHeaders.ContentType, mime)
                            append(HttpHeaders.ContentDisposition, "filename=\"$fileName\"")
                        })
                    },
                ),
            )
        }
        val text = response.bodyAsText()
        val parsed = runCatching { ApiJson.parseToJsonElement(text) }.getOrNull()
        if (!response.status.isSuccess()) {
            val message = (parsed as? JsonObject)?.let { (it["message"] ?: it["error"])?.jsonPrimitive?.contentOrNull } ?: "HTTP ${response.status.value}"
            throw ApiException(response.status.value, message, parsed)
        }
        return parsed ?: JsonObject(emptyMap())
    }

    fun absoluteUrl(pathOrUrl: String?): String? = when {
        pathOrUrl.isNullOrBlank() -> null
        pathOrUrl.startsWith("http") -> pathOrUrl
        else -> HelloCalConfig.BASE_URL + (if (pathOrUrl.startsWith("/")) pathOrUrl else "/$pathOrUrl")
    }
}

/** Serialises Maps/Lists/primitives (screens build small request bodies as maps). */
@Suppress("UNCHECKED_CAST")
fun encodeAny(value: Any?): String = when (value) {
    null -> "null"
    is JsonElement -> value.toString()
    is String -> Json.encodeToString(kotlinx.serialization.serializer<String>(), value)
    is Number, is Boolean -> value.toString()
    is Map<*, *> -> value.entries.joinToString(",", "{", "}") { (k, v) -> "${encodeAny(k.toString())}:${encodeAny(v)}" }
    is Iterable<*> -> value.joinToString(",", "[", "]") { encodeAny(it) }
    is Array<*> -> value.joinToString(",", "[", "]") { encodeAny(it) }
    else -> encodeAny(value.toString())
}

/** Cookie jar persisted in the encrypted store, so the login survives restarts. */
object PersistentCookies : CookiesStorage {
    private const val KEY = "cookies"
    private val mutex = Mutex()

    @Serializable
    private data class Stored(val name: String, val value: String, val domain: String?, val path: String?, val expires: Long?, val secure: Boolean, val httpOnly: Boolean)

    private fun load(): MutableList<Stored> = NativeHooks.secureStorage.get(KEY)
        ?.let { runCatching { ApiJson.decodeFromString<List<Stored>>(it) }.getOrNull() }
        ?.toMutableList() ?: mutableListOf()

    private fun save(list: List<Stored>) = NativeHooks.secureStorage.set(KEY, ApiJson.encodeToString(list))

    override suspend fun addCookie(requestUrl: Url, cookie: Cookie) = mutex.withLock {
        val list = load()
        list.removeAll { it.name == cookie.name }
        val expires = cookie.expires?.timestamp ?: cookie.maxAge?.let { if (it > 0) GMTDate().timestamp + it * 1000L else 0L }
        if (cookie.value.isNotEmpty() && (expires == null || expires > GMTDate().timestamp)) {
            list += Stored(cookie.name, cookie.value, cookie.domain ?: requestUrl.host, cookie.path ?: "/", expires, cookie.secure, cookie.httpOnly)
        }
        save(list)
    }

    override suspend fun get(requestUrl: Url): List<Cookie> = mutex.withLock {
        val now = GMTDate().timestamp
        load().filter { (it.expires == null || it.expires > now) && requestUrl.host.endsWith(it.domain?.trimStart('.') ?: requestUrl.host) }
            .map { Cookie(it.name, it.value, domain = it.domain, path = it.path, secure = it.secure, httpOnly = it.httpOnly) }
    }

    suspend fun clear() = mutex.withLock { NativeHooks.secureStorage.set(KEY, null) }

    fun hasAny(): Boolean = load().isNotEmpty()

    override fun close() {}
}

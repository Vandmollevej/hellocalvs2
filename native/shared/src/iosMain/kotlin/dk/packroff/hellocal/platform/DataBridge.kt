package dk.packroff.hellocal.platform

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned
import platform.Foundation.NSData
import platform.Foundation.create
import platform.posix.memcpy

/**
 * Kotlin ByteArray ↔ Swift Data for the device layer (iosApp/HelloCal/IosDevice.swift).
 * Swift: `DataBridge.shared.toByteArray(data: data)` and `DataBridge.shared.toData(bytes: bytes)`.
 */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
object DataBridge {
    fun toByteArray(data: NSData): ByteArray {
        val size = data.length.toInt()
        val bytes = ByteArray(size)
        if (size > 0) {
            bytes.usePinned { pinned -> memcpy(pinned.addressOf(0), data.bytes, data.length) }
        }
        return bytes
    }

    fun toData(bytes: ByteArray): NSData {
        if (bytes.isEmpty()) return NSData()
        return bytes.usePinned { pinned -> NSData.create(bytes = pinned.addressOf(0), length = bytes.size.toULong()) }
    }
}

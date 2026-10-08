// The iPhone app: hosts the shared Kotlin screens (native/shared) and wires in
// Keychain storage, deep links and the WidgetKit widgets.
import Shared
import SwiftUI
import UIKit
import WidgetKit

@main
struct HelloCalApp: App {
    init() {
        NativeHooks.shared.secureStorage = KeychainStorage()
        NativeHooks.shared.onDeviceToken = { token in
            DeviceTokenStore.write(token)
            WidgetCenter.shared.reloadAllTimelines()
        }
        NativeHooks.shared.onRegistrationChanged = {
            WidgetCenter.shared.reloadAllTimelines()
        }
        NativeHooks.shared.onLogout = {
            DeviceTokenStore.write("")
            WidgetCenter.shared.reloadAllTimelines()
        }
        NativeHooks.shared.openExternalUrl = { url in
            if let target = URL(string: url) { UIApplication.shared.open(target) }
        }
    }

    var body: some Scene {
        WindowGroup {
            ComposeView()
                .ignoresSafeArea(.all)
                // hellocal://<web path> from widgets → same screen as the web path.
                .onOpenURL { url in DeepLinks.shared.open(url: url.absoluteString) }
        }
    }
}

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

/// Kotlin's SecureStorage backed by the Keychain (this device only).
final class KeychainStorage: SecureStorage {
    private let service = "dk.packroff.hellocal.app"

    func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func set(key: String, value: String?) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(base as CFDictionary)
        guard let value else { return }
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}
